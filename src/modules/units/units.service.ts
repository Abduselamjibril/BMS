import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit, UnitStatus } from './entities/unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UnitAmenity } from '../amenities/entities/unit-amenity.entity';
import { Amenity } from '../amenities/entities/amenity.entity';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(UnitAmenity)
    private readonly unitAmenityRepo: Repository<UnitAmenity>,
    @InjectRepository(Amenity)
    private readonly amenityRepo: Repository<Amenity>,
  ) {}

  async create(dto: CreateUnitDto): Promise<Unit> {
    // Unique unit_number per building
    const exists = await this.unitRepository.findOne({ where: { building: { id: dto['buildingId'] }, unit_number: dto['unit_number'] } });
    if (exists) throw new ConflictException('Unit number must be unique per building');
    const unit = this.unitRepository.create(dto);
    return this.unitRepository.save(unit);
  }

  async findAll(buildingId?: string, status?: string): Promise<Unit[]> {
    const where: any = {};
    if (buildingId) where.building = { id: buildingId };
    if (status) where.status = status;
    return this.unitRepository.find({ where });
  }

  async findOne(id: string): Promise<Unit | null> {
    return this.unitRepository.findOne({ where: { id } });
  }

  async update(id: string, dto: Partial<CreateUnitDto>): Promise<Unit | null> {
    // Ensure floor is a number if present
    const updatePayload = { ...dto, floor: dto.floor };
    await this.unitRepository.update(id, updatePayload);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const unit = await this.unitRepository.findOne({ where: { id } });
    if (!unit) throw new BadRequestException('Unit not found');
    if (unit.status === UnitStatus.OCCUPIED) throw new BadRequestException('Cannot delete occupied unit');
    await this.unitRepository.delete(id);
  }

  // Bulk upload (CSV parsing logic placeholder)
  async bulkUpload(file: any) {
    // Parse CSV, validate, and bulk insert
    // Placeholder: return file info
    return { uploaded: true, filename: file.originalname };
  }

  // Amenity management
  async addAmenity(unitId: string, amenityId: string) {
    const unit = await this.unitRepository.findOne({ where: { id: unitId } });
    const amenity = await this.amenityRepo.findOne({ where: { id: amenityId } });
    if (!unit || !amenity) throw new BadRequestException('Invalid unit or amenity');
    const exists = await this.unitAmenityRepo.findOne({ where: { unit: { id: unitId }, amenity: { id: amenityId } } });
    if (exists) throw new ConflictException('Amenity already linked');
    const link = this.unitAmenityRepo.create({ unit, amenity });
    return this.unitAmenityRepo.save(link);
  }

  async removeAmenity(unitId: string, amenityId: string) {
    const link = await this.unitAmenityRepo.findOne({ where: { unit: { id: unitId }, amenity: { id: amenityId } } });
    if (!link) throw new BadRequestException('Amenity link not found');
    await this.unitAmenityRepo.delete(link.id);
    return { removed: true };
  }
}
