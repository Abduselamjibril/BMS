import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Building } from '../buildings/entities/building.entity';
import { Unit } from '../units/entities/unit.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
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
  }): Promise<Asset[]> {
    const qb = this.assetRepository.createQueryBuilder('asset');

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

  async findOne(id: string): Promise<Asset> {
    const asset = await this.assetRepository.findOne({
      where: { id },
      relations: ['building', 'unit'],
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto): Promise<Asset> {
    const asset = await this.findOne(id);
    const { buildingId, unitId, ...assetData } = updateAssetDto;

    Object.assign(asset, assetData);

    if (buildingId !== undefined) asset.buildingId = buildingId || undefined;
    if (unitId !== undefined) asset.unitId = unitId || undefined;

    return this.assetRepository.save(asset);
  }

  async remove(id: string): Promise<{ message: string }> {
    const asset = await this.findOne(id);
    await this.assetRepository.remove(asset);
    return { message: 'Asset deleted successfully.' };
  }
}
