import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building } from './entities/building.entity';
import { CreateBuildingDto } from './dto/create-building.dto';
import { Unit } from '../units/entities/unit.entity';
import { BuildingAdminAssignment } from './entities/building-admin-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { Owner } from '../owners/entities/owner.entity';

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
    @InjectRepository(Site)
    private readonly siteRepository: Repository<Site>,
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
  ) {}

  async create(dto: CreateBuildingDto): Promise<Building> {
    // Fetch related Site and Owner
    const site = await this.siteRepository.findOne({ where: { id: dto.siteId } });
    if (!site) throw new NotFoundException('Site not found');
    const owner = await this.ownerRepository.findOne({ where: { id: dto.ownerId } });
    if (!owner) throw new NotFoundException('Owner not found');

    // Parse latitude and longitude from site.location_lat_long
    let latitude: number | undefined = undefined;
    let longitude: number | undefined = undefined;
    if (site.location_lat_long) {
      const [lat, long] = site.location_lat_long.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(long)) {
        latitude = lat;
        longitude = long;
      }
    }

    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestException('Site location_lat_long must be a valid "lat,long" value');
    }

    // Create building and assign relations, using site data for missing fields
    const building = this.buildingRepository.create({
      ...dto,
      site,
      owner,
      country: 'Ethiopia',
      city: site.city,
      subcity: site.subcity,
      latitude,
      longitude,
      total_units: 0,
    });
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
