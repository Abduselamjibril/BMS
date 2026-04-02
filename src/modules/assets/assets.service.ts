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
    const asset = this.assetRepository.create(assetData);

    if (buildingId) {
      const building = await this.buildingRepository.findOne({
        where: { id: buildingId },
      });
      if (building) asset.building = building;
    }

    if (unitId) {
      const unit = await this.unitRepository.findOne({ where: { id: unitId } });
      if (unit) asset.unit = unit;
    }

    return this.assetRepository.save(asset);
  }

  async findAll(): Promise<Asset[]> {
    return this.assetRepository.find({
      relations: ['building', 'unit'],
      order: { created_at: 'DESC' },
    });
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

    if (buildingId !== undefined) {
      if (buildingId) {
        const building = await this.buildingRepository.findOne({
          where: { id: buildingId },
        });
        if (building) asset.building = building;
      } else {
        asset.building = undefined;
      }
    }

    if (unitId !== undefined) {
      if (unitId) {
        const unit = await this.unitRepository.findOne({
          where: { id: unitId },
        });
        if (unit) asset.unit = unit;
      } else {
        asset.unit = undefined;
      }
    }

    return this.assetRepository.save(asset);
  }

  async remove(id: string): Promise<{ message: string }> {
    const asset = await this.findOne(id);
    await this.assetRepository.remove(asset);
    return { message: 'Asset deleted successfully.' };
  }
}
