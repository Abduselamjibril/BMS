import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './entities/site.entity';
import { Building } from '../buildings/entities/building.entity';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
  ) {}

  async create(dto: Partial<Site>): Promise<Site> {
    const site = this.siteRepo.create(dto);
    return this.siteRepo.save(site);
  }

  async findAll(): Promise<Site[]> {
    return this.siteRepo.find({ relations: ['buildings'] });
  }

  async update(id: string, dto: Partial<Site>): Promise<Site | null> {
    await this.siteRepo.update(id, dto);
    return this.siteRepo.findOne({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    const buildings = await this.buildingRepo.find({ where: { site: { id } } });
    if (buildings.length > 0) throw new BadRequestException('Cannot delete site with linked buildings');
    await this.siteRepo.delete(id);
  }
}
