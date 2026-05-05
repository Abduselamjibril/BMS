import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Building } from './entities/building.entity';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
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
    const site = await this.siteRepository.findOne({
      where: { id: dto.siteId },
    });
    if (!site) throw new NotFoundException('Site not found');
    const owner = await this.ownerRepository.findOne({
      where: { id: dto.ownerId },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    const building = this.buildingRepository.create({
      ...dto,
      site,
      owner,
      country: 'Ethiopia',
      city: site.city,
      subcity: site.subcity,
      location: site.location,
      total_units: 0,
    });
    return this.buildingRepository.save(building);
  }

  async findAll(userId?: string, roles: string[] = []): Promise<Building[]> {
    if ((roles.includes('nominee_admin') || roles.includes('site_admin')) && userId) {
      const assignments = await this.adminAssignmentRepo.find({
        where: { user: { id: userId } },
        relations: ['building'],
      });
      
      // Also get buildings from sites managed by this user
      const managedSites = await this.siteRepository.find({
        where: { manager_id: userId },
        relations: ['buildings'],
      });
      const siteBuildingIds = managedSites.flatMap(s => s.buildings?.map(b => b.id) || []);
      const directBuildingIds = assignments.map((a) => a.building.id);
      
      const allIds = [...new Set([...siteBuildingIds, ...directBuildingIds])];
      
      if (allIds.length === 0) return [];
      
      return this.buildingRepository.find({
        where: { id: In(allIds) }
      });
    }
    
    if (roles.includes('super_admin') || roles.includes('admin')) {
      return this.buildingRepository.find({ relations: ['owner', 'site'] });
    }

    if (roles.includes('owner') && userId) {
      const owner = await this.ownerRepository.findOne({ where: { user: { id: userId } } });
      if (!owner) return [];
      return this.buildingRepository.find({
        where: { owner: { id: owner.id } },
        relations: ['owner', 'site']
      });
    }

    return this.buildingRepository.find({ relations: ['owner', 'site'] });
  }

  async findOne(id: string, userId?: string, roles: string[] = []): Promise<Building> {
    const building = await this.buildingRepository.findOne({ 
      where: { id },
      relations: ['owner', 'site'] 
    });
    if (!building) throw new NotFoundException('Building not found');

    if (roles.includes('owner') && userId) {
      const owner = await this.ownerRepository.findOne({ where: { user: { id: userId } } });
      if (!owner || building.owner.id !== owner.id) {
        throw new ForbiddenException('You do not have access to this building');
      }
    }

    return building;
  }

  async update(
    id: string,
    dto: UpdateBuildingDto,
    userId?: string,
    roles: string[] = [],
  ): Promise<Building> {
    const building = await this.findOne(id, userId, roles);

    // Handle relations
    if (dto.siteId) {
      const site = await this.siteRepository.findOne({
        where: { id: dto.siteId },
      });
      if (!site) throw new NotFoundException('Site not found');
      building.site = site;
    }
    if (dto.ownerId) {
      const owner = await this.ownerRepository.findOne({
        where: { id: dto.ownerId },
      });
      if (!owner) throw new NotFoundException('Owner not found');
      building.owner = owner;
    }

    // Assign other fields
    const { siteId, ownerId, ...rest } = dto;
    Object.assign(building, rest);

    return this.buildingRepository.save(building);
  }

  async remove(id: string, userId?: string, roles: string[] = []): Promise<any> {
    const building = await this.findOne(id, userId, roles);
    const units = await this.unitRepository.find({
      where: { building: { id } },
    });
    if (units.length > 0)
      throw new BadRequestException('Cannot delete building with units');
    await this.buildingRepository.delete(id);
    return { message: 'Building deleted successfully.' };
  }

  async assignAdmin(buildingId: string, userId: string) {
    const building = await this.buildingRepository.findOne({
      where: { id: buildingId },
    });
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!building || !user)
      throw new BadRequestException('Invalid building or user');

    const exists = await this.adminAssignmentRepo.findOne({
      where: { building: { id: buildingId }, user: { id: userId } },
    });
    if (exists)
      throw new ConflictException('User already assigned to building');

    const assignment = this.adminAssignmentRepo.create({ building, user });
    return this.adminAssignmentRepo.save(assignment);
  }

  async getAdmins(buildingId: string) {
    const assignments = await this.adminAssignmentRepo.find({
      where: { building: { id: buildingId } },
      relations: ['user'],
    });
    return assignments.map((a) => a.user);
  }

  async revokeAdmin(buildingId: string, userId: string) {
    const assignment = await this.adminAssignmentRepo.findOne({
      where: { building: { id: buildingId }, user: { id: userId } },
    });
    if (!assignment) throw new BadRequestException('Assignment not found');
    await this.adminAssignmentRepo.delete(assignment.id);
    return { revoked: true };
  }

  async getAmenities(buildingId: string) {
    const building = await this.buildingRepository.findOne({
      where: { id: buildingId },
      relations: ['buildingAmenities', 'buildingAmenities.amenity'],
    });
    if (!building) throw new BadRequestException('Building not found');
    return building.buildingAmenities.map((ba) => ba.amenity);
  }
}
