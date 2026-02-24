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
    const site = await this.siteRepository.findOne({ where: { id: dto.siteId } });
    if (!site) throw new NotFoundException('Site not found');
    const owner = await this.ownerRepository.findOne({ where: { id: dto.ownerId } });
    if (!owner) throw new NotFoundException('Owner not found');

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
      const assignments = await this.adminAssignmentRepo.find({ 
        where: { user: { id: userId } }, 
        relations: ['building'] 
      });
      return assignments.map(a => a.building);
    }
    return this.buildingRepository.find();
  }

  async findOne(id: string): Promise<Building> {
    const building = await this.buildingRepository.findOne({ where: { id } });
    if (!building) throw new NotFoundException('Building not found');
    return building;
  }

  async update(id: string, dto: Partial<CreateBuildingDto & { siteId?: string; ownerId?: string }>): Promise<{ message: string; building?: Building }> {
    const building = await this.buildingRepository.findOne({ where: { id } });
    if (!building) throw new NotFoundException('Building not found');

    // Handle relations
    let updatePayload: any = { ...dto };
    if (dto.siteId) {
      const site = await this.siteRepository.findOne({ where: { id: dto.siteId } });
      if (!site) throw new NotFoundException('Site not found');
      updatePayload.site = site;
      delete updatePayload.siteId;
    }
    if (dto.ownerId) {
      const owner = await this.ownerRepository.findOne({ where: { id: dto.ownerId } });
      if (!owner) throw new NotFoundException('Owner not found');
      updatePayload.owner = owner;
      delete updatePayload.ownerId;
    }

    await this.buildingRepository.update(id, updatePayload);
    const updated = await this.buildingRepository.findOne({ where: { id } });
    return { message: 'Building updated successfully.', building: updated ?? undefined };
  }

  async remove(id: string): Promise<{ message: string }> {
    const building = await this.buildingRepository.findOne({ where: { id } });
    if (!building) return { message: 'Building not found or already deleted.' };
    const units = await this.unitRepository.find({ where: { building: { id } } });
    if (units.length > 0) throw new BadRequestException('Cannot delete building with units');
    await this.buildingRepository.delete(id);
    return { message: 'Building deleted successfully.' };
  }

  async assignAdmin(buildingId: string, userId: string) {
    const building = await this.buildingRepository.findOne({ where: { id: buildingId } });
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!building || !user) throw new BadRequestException('Invalid building or user');
    
    const exists = await this.adminAssignmentRepo.findOne({ 
      where: { building: { id: buildingId }, user: { id: userId } } 
    });
    if (exists) throw new ConflictException('User already assigned to building');
    
    const assignment = this.adminAssignmentRepo.create({ building, user });
    return this.adminAssignmentRepo.save(assignment);
  }

  async getAdmins(buildingId: string) {
    const assignments = await this.adminAssignmentRepo.find({ 
      where: { building: { id: buildingId } }, 
      relations: ['user'] 
    });
    return assignments.map(a => a.user);
  }

  async revokeAdmin(buildingId: string, userId: string) {
    const assignment = await this.adminAssignmentRepo.findOne({ 
      where: { building: { id: buildingId }, user: { id: userId } } 
    });
    if (!assignment) throw new BadRequestException('Assignment not found');
    await this.adminAssignmentRepo.delete(assignment.id);
    return { revoked: true };
  }

  async getAmenities(buildingId: string) {
    const building = await this.buildingRepository.findOne({ 
      where: { id: buildingId }, 
      relations: ['buildingAmenities', 'buildingAmenities.amenity'] 
    });
    if (!building) throw new BadRequestException('Building not found');
    return building.buildingAmenities.map((ba) => ba.amenity);
  }
}