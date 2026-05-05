import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Unit, UnitStatus, UnitType } from './entities/unit.entity';
import { Building } from '../buildings/entities/building.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UnitAmenity } from '../amenities/entities/unit-amenity.entity';
import { Amenity } from '../amenities/entities/amenity.entity';
import { Owner } from '../owners/entities/owner.entity';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(UnitAmenity)
    private readonly unitAmenityRepo: Repository<UnitAmenity>,
    @InjectRepository(Amenity)
    private readonly amenityRepo: Repository<Amenity>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
  ) {}

  async create(dto: CreateUnitDto, userId?: string, roles: string[] = []): Promise<Unit> {
    const building = await this.buildingRepository.findOne({
      where: { id: dto.buildingId },
      relations: ['owner']
    });
    if (!building) throw new BadRequestException('Building not found');

    if (roles.includes('owner') && userId) {
      const owner = await this.ownerRepository.findOne({ where: { user: { id: userId } } });
      if (!owner || building.owner.id !== owner.id) {
        throw new ForbiddenException('You can only create units in your own buildings');
      }
    }

    const exists = await this.unitRepository.findOne({
      where: { building: { id: dto.buildingId }, unit_number: dto.unit_number },
    });
    if (exists)
      throw new ConflictException('Unit number must be unique per building');

    const isCommercial = dto.type === UnitType.SHOP || dto.type === UnitType.OFFICE;
    const bedrooms = isCommercial ? 0 : (dto.bedrooms || 0);
    const bathrooms = isCommercial ? 0 : (dto.bathrooms || 0);

    const unit = this.unitRepository.create({ 
      ...dto, 
      building,
      bedrooms,
      bathrooms
    });
    return this.unitRepository.save(unit);
  }

  async findAll(buildingId?: string, status?: string, userId?: string, roles: string[] = []): Promise<Unit[]> {
    const where: any = {};
    if (buildingId) where.building = { id: buildingId };
    if (status) where.status = status.toUpperCase();

    if (roles.includes('owner') && userId) {
      const owner = await this.ownerRepository.findOne({ where: { user: { id: userId } } });
      if (!owner) return [];
      
      // Filter units belonging to this owner's buildings
      const ownerBuildings = await this.buildingRepository.find({
        where: { owner: { id: owner.id } },
        select: ['id']
      });
      const buildingIds = ownerBuildings.map(b => b.id);
      
      if (buildingIds.length === 0) return [];
      
      // If a specific building was requested, ensure it belongs to the owner
      if (buildingId && !buildingIds.includes(buildingId)) {
        return [];
      }

      where.building = In(buildingIds);
    }

    return this.unitRepository.find({ where, relations: ['building'] });
  }

  async findOne(id: string, userId?: string, roles: string[] = []): Promise<Unit | null> {
    const unit = await this.unitRepository.findOne({
      where: { id },
      relations: ['building', 'building.owner'],
    });
    if (!unit) return null;

    if (roles.includes('owner') && userId) {
      const owner = await this.ownerRepository.findOne({ where: { user: { id: userId } } });
      if (!owner || unit.building.owner.id !== owner.id) {
        throw new ForbiddenException('You do not have access to this unit');
      }
    }

    return unit;
  }

  async update(
    id: string,
    dto: Partial<CreateUnitDto & { buildingId?: string }>,
    userId?: string,
    roles: string[] = [],
  ): Promise<Unit | null> {
    const unit = await this.findOne(id, userId, roles);
    if (!unit) throw new NotFoundException('Unit not found');

    const updatePayload: any = { ...dto };
    if (dto.buildingId) {
      const building = await this.buildingRepository.findOne({
        where: { id: dto.buildingId },
        relations: ['owner']
      });
      if (!building) throw new BadRequestException('Building not found');
      
      // If owner, ensure they own the target building too
      if (roles.includes('owner') && userId) {
        const owner = await this.ownerRepository.findOne({ where: { user: { id: userId } } });
        if (!owner || building.owner.id !== owner.id) {
          throw new ForbiddenException('You can only move units to your own buildings');
        }
      }
      
      updatePayload.building = building;
      delete updatePayload.buildingId;
    }
    if (dto.type) {
      const isCommercial = dto.type === UnitType.SHOP || dto.type === UnitType.OFFICE;
      if (isCommercial) {
        updatePayload.bedrooms = 0;
        updatePayload.bathrooms = 0;
      }
    }

    await this.unitRepository.update(id, updatePayload);
    return this.findOne(id, userId, roles);
  }

  async remove(id: string, userId?: string, roles: string[] = []): Promise<{ message: string }> {
    const unit = await this.findOne(id, userId, roles);
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status === UnitStatus.OCCUPIED)
      throw new BadRequestException('Cannot delete occupied unit');
    await this.unitRepository.delete(id);
    return { message: 'Unit deleted successfully.' };
  }

  async bulkUpload(file: any) {
    return { uploaded: true, filename: file.originalname };
  }

  async addAmenity(unitId: string, amenityId: string) {
    const unit = await this.unitRepository.findOne({ where: { id: unitId } });
    const amenity = await this.amenityRepo.findOne({
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

  async removeAmenity(unitId: string, amenityId: string) {
    const link = await this.unitAmenityRepo.findOne({
      where: { unit: { id: unitId }, amenity: { id: amenityId } },
    });
    if (!link) throw new BadRequestException('Amenity link not found');
    await this.unitAmenityRepo.delete(link.id);
    return { removed: true };
  }

  async getAmenities(unitId: string) {
    const unit = await this.unitRepository.findOne({
      where: { id: unitId },
      relations: ['unitAmenities', 'unitAmenities.amenity'],
    });
    if (!unit) throw new BadRequestException('Unit not found');
    return unit.unitAmenities.map((ua) => ua.amenity);
  }
}
