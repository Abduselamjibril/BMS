import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building } from './entities/building.entity';
import { CreateBuildingDto } from './dto/create-building.dto';
import { Unit } from '../units/entities/unit.entity';
import { BuildingAdminAssignment } from './entities/building-admin-assignment.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(BuildingAdminAssignment)
    private readonly adminAssignmentRepo: Repository<BuildingAdminAssignment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateBuildingDto): Promise<Building> {
    // Validate unique code
    const exists = await this.buildingRepository.findOne({ where: { code: dto['code'] } });
    if (exists) throw new ConflictException('Building code must be unique');
    const building = this.buildingRepository.create(dto);
    return this.buildingRepository.save(building);
  }

  async findAll(userId?: string, role?: string): Promise<Building[]> {
    if (role === 'nominee_admin' && userId) {
      // Only buildings assigned to this user
      const assignments = await this.adminAssignmentRepo.find({ where: { user: { id: userId } }, relations: ['building'] });
      return assignments.map(a => a.building);
    }
    return this.buildingRepository.find();
  }

  async findOne(id: string): Promise<Building | null> {
    return this.buildingRepository.findOne({ where: { id } });
  }

  async update(id: string, dto: Partial<CreateBuildingDto>): Promise<Building | null> {
    await this.buildingRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    // Fail if any units exist in this building
    const units = await this.unitRepository.find({ where: { building: { id } } });
    if (units.length > 0) throw new BadRequestException('Cannot delete building with units');
    await this.buildingRepository.delete(id);
  }

  // Assignment engine
  async assignAdmin(buildingId: string, userId: string) {
    const building = await this.buildingRepository.findOne({ where: { id: buildingId } });
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!building || !user) throw new BadRequestException('Invalid building or user');
    const exists = await this.adminAssignmentRepo.findOne({ where: { building: { id: buildingId }, user: { id: userId } } });
    if (exists) throw new ConflictException('User already assigned to building');
    const assignment = this.adminAssignmentRepo.create({ building, user });
    return this.adminAssignmentRepo.save(assignment);
  }

  async getAdmins(buildingId: string) {
    const assignments = await this.adminAssignmentRepo.find({ where: { building: { id: buildingId } }, relations: ['user'] });
    return assignments.map(a => a.user);
  }

  async revokeAdmin(buildingId: string, userId: string) {
    const assignment = await this.adminAssignmentRepo.findOne({ where: { building: { id: buildingId }, user: { id: userId } } });
    if (!assignment) throw new BadRequestException('Assignment not found');
    await this.adminAssignmentRepo.delete(assignment.id);
    return { revoked: true };
  }
}
