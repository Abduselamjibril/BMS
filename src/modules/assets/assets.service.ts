import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Building } from '../buildings/entities/building.entity';
import { Unit } from '../units/entities/unit.entity';
import { Owner } from '../owners/entities/owner.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async create(createAssetDto: CreateAssetDto): Promise<Asset> {
    const { buildingId, unitId, ...assetData } = createAssetDto;
    const asset = this.assetRepository.create({
      ...assetData,
      buildingId,
      unitId,
    });
    return this.assetRepository.save(asset);
  }

  async findAll(filters?: { 
    category?: string; 
    condition?: string; 
    buildingId?: string;
    unitId?: string;
    authenticatedUser?: any;
  }): Promise<Asset[]> {
    const qb = this.assetRepository.createQueryBuilder('asset');

    if (filters?.authenticatedUser) {
      const currentUserId = filters.authenticatedUser.id || filters.authenticatedUser.sub;
      const userRoles = await this.userRoleRepository.find({
        where: { user: { id: currentUserId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map((ur) => ur.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepository.findOne({ where: { user: { id: currentUserId } } });
        if (!owner) return [];
        qb.innerJoin('asset.building', 'b_owner')
          .andWhere('b_owner.ownerId = :oid', { oid: owner.id });
      }
    }

    qb.leftJoinAndSelect('asset.building', 'building')
      .leftJoinAndSelect('asset.unit', 'unit')
      .orderBy('asset.created_at', 'DESC');

    if (filters?.category) {
      qb.andWhere('asset.category = :category', { category: filters.category });
    }
    if (filters?.condition) {
      qb.andWhere('asset.condition = :condition', { condition: filters.condition });
    }
    if (filters?.buildingId) {
      qb.andWhere('asset.buildingId = :buildingId', { buildingId: filters.buildingId });
    }
    if (filters?.unitId) {
      qb.andWhere('asset.unitId = :unitId', { unitId: filters.unitId });
    }

    return qb.getMany();
  }

  async findOne(id: string, authenticatedUser?: any): Promise<Asset> {
    const asset = await this.assetRepository.findOne({
      where: { id },
      relations: ['building', 'building.owner', 'unit'],
    });
    if (!asset) throw new NotFoundException('Asset not found');

    if (authenticatedUser) {
      const currentUserId = authenticatedUser.id || authenticatedUser.sub;
      const userRoles = await this.userRoleRepository.find({
        where: { user: { id: currentUserId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map((ur) => ur.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepository.findOne({ where: { user: { id: currentUserId } } });
        if (!owner || !asset.building || asset.building.owner.id !== owner.id) {
          throw new ForbiddenException('You do not have access to this asset');
        }
      }
    }

    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto, authenticatedUser?: any): Promise<Asset> {
    const asset = await this.findOne(id, authenticatedUser);
    const { buildingId, unitId, ...assetData } = updateAssetDto;

    // If changing building, verify ownership
    if (buildingId) {
      const building = await this.buildingRepository.findOne({ where: { id: buildingId }, relations: ['owner'] });
      if (building && authenticatedUser) {
        const owner = await this.ownerRepository.findOne({ where: { user: { id: authenticatedUser.id || authenticatedUser.sub } } });
        if (owner && building.owner.id !== owner.id) {
          throw new ForbiddenException('Target building must belong to you');
        }
      }
    }

    Object.assign(asset, assetData);

    if (buildingId !== undefined) asset.buildingId = buildingId || undefined;
    if (unitId !== undefined) asset.unitId = unitId || undefined;

    return this.assetRepository.save(asset);
  }

  async remove(id: string, authenticatedUser?: any): Promise<any> {
    const asset = await this.findOne(id, authenticatedUser);
    await this.assetRepository.remove(asset);
    return { message: 'Asset deleted successfully.' };
  }
}
