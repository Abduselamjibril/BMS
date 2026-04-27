import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Amenity } from './entities/amenity.entity';
import { BuildingAmenity } from './entities/building-amenity.entity';
import { UnitAmenity } from './entities/unit-amenity.entity';
import { Building } from '../buildings/entities/building.entity';
import { Unit } from '../units/entities/unit.entity';
import { CreateAmenityDto } from './dto/create-amenity.dto';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectRepository(Amenity)
    private readonly amenityRepository: Repository<Amenity>,
    @InjectRepository(BuildingAmenity)
    private readonly buildingAmenityRepo: Repository<BuildingAmenity>,
    @InjectRepository(UnitAmenity)
    private readonly unitAmenityRepo: Repository<UnitAmenity>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
  ) {}
  // Link amenity to building
  async linkToBuilding(buildingId: string, amenityId: string) {
    const building = await this.buildingRepo.findOne({
      where: { id: buildingId },
    });
    const amenity = await this.amenityRepository.findOne({
      where: { id: amenityId },
    });
    if (!building || !amenity)
      throw new BadRequestException('Invalid building or amenity');
    const exists = await this.buildingAmenityRepo.findOne({
      where: { building: { id: buildingId }, amenity: { id: amenityId } },
    });
    if (exists) throw new ConflictException('Amenity already linked');
    const link = this.buildingAmenityRepo.create({ building, amenity });
    return this.buildingAmenityRepo.save(link);
  }

  async unlinkFromBuilding(buildingId: string, amenityId: string) {
    const link = await this.buildingAmenityRepo.findOne({
      where: { building: { id: buildingId }, amenity: { id: amenityId } },
    });
    if (!link) throw new BadRequestException('Amenity link not found');
    await this.buildingAmenityRepo.delete(link.id);
    return { removed: true };
  }

  // Link amenity to unit
  async linkToUnit(unitId: string, amenityId: string) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    const amenity = await this.amenityRepository.findOne({
      where: { id: amenityId },
    });
    if (!unit || !amenity)
      throw new BadRequestException('Invalid unit or amenity');
    const exists = await this.unitAmenityRepo.findOne({
      where: { unit: { id: unitId }, amenity: { id: amenityId } },
    });
    if (exists) throw new ConflictException('Amenity already linked');
    const link = this.unitAmenityRepo.create({ unit, amenity });
    return this.unitAmenityRepo.save(link);
  }

  async unlinkFromUnit(unitId: string, amenityId: string) {
    const link = await this.unitAmenityRepo.findOne({
      where: { unit: { id: unitId }, amenity: { id: amenityId } },
    });
    if (!link) throw new BadRequestException('Amenity link not found');
    await this.unitAmenityRepo.delete(link.id);
    return { removed: true };
  }

  async create(dto: CreateAmenityDto): Promise<Amenity> {
    const existing = await this.amenityRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Amenity "${dto.name}" already exists`);
    const amenity = this.amenityRepository.create(dto);
    return this.amenityRepository.save(amenity);
  }

  async findAll(query?: any): Promise<any[]> {
    const qb = this.amenityRepository.createQueryBuilder('amenity');

    // Load relations for compatibility with frontend expectations
    qb.leftJoinAndSelect('amenity.buildingAmenities', 'ba_load')
      .leftJoinAndSelect('ba_load.building', 'b_load')
      .leftJoinAndSelect('amenity.unitAmenities', 'ua_load')
      .leftJoinAndSelect('ua_load.unit', 'u_load')
      .leftJoinAndSelect('u_load.building', 'ub_load');

    if (query?.buildingId) {
      qb.andWhere((subQb) => {
        const subQuery = subQb
          .subQuery()
          .select('1')
          .from(BuildingAmenity, 'ba_filter')
          .where('ba_filter.amenity_id = amenity.id')
          .andWhere('ba_filter.building_id = :buildingId', {
            buildingId: query.buildingId,
          })
          .getQuery();
        return `EXISTS (${subQuery})`;
      }, { buildingId: query.buildingId });
    }

    if (query?.unitId) {
      qb.andWhere((subQb) => {
        const subQuery = subQb
          .subQuery()
          .select('1')
          .from(UnitAmenity, 'ua_filter')
          .where('ua_filter.amenity_id = amenity.id')
          .andWhere('ua_filter.unit_id = :unitId', { unitId: query.unitId })
          .getQuery();
        return `EXISTS (${subQuery})`;
      }, { unitId: query.unitId });
    }

    qb.orderBy('amenity.name', 'ASC');

    const results = await qb.getMany();

    // Map to include linked_buildings and linked_units just like findOne does
    return results.map((amenity) => ({
      ...amenity,
      linked_buildings: (amenity.buildingAmenities || []).map((ba) => ba.building),
      linked_units: (amenity.unitAmenities || []).map((ua) => ua.unit),
    }));
  }

  async findOne(id: string): Promise<any | null> {
    const amenity = await this.amenityRepository.findOne({
      where: { id },
      relations: [
        'buildingAmenities',
        'buildingAmenities.building',
        'unitAmenities',
        'unitAmenities.unit',
        'unitAmenities.unit.building',
      ],
    });
    if (!amenity) return null;
    return {
      ...amenity,
      linked_buildings: (amenity.buildingAmenities || []).map((ba) => ba.building),
      linked_units: (amenity.unitAmenities || []).map((ua) => ua.unit),
    };
  }

  async update(
    id: string,
    dto: Partial<CreateAmenityDto>,
  ): Promise<Amenity | null> {
    await this.amenityRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const amenity = await this.amenityRepository.findOne({ where: { id } });
    if (!amenity) return { message: 'Amenity not found or already deleted.' };
    await this.amenityRepository.delete(id);
    return { message: 'Amenity deleted successfully.' };
  }
}
