import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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

  async findOne(id: string): Promise<Site | null> {
    // Note: Use "id: id as any" if your Entity ID is a number but your param is a string
    return this.siteRepo.findOne({
      where: { id: id as any },
      relations: ['buildings'],
    });
  }

  async update(id: string, dto: Partial<Site>): Promise<Site | null> {
    const prepared = await this.siteRepo.preload({
      id: id as any,
      ...(dto as object),
    });
    if (!prepared) throw new NotFoundException('Site not found');
    return this.siteRepo.save(prepared);
  }

  async remove(id: string): Promise<{ message: string }> {
    // Check if there are linked buildings before deleting
    const buildings = await this.buildingRepo.find({
      where: { site: { id: id as any } },
    });

    if (buildings.length > 0) {
      throw new BadRequestException('Cannot delete site with linked buildings');
    }

    const site = await this.siteRepo.findOne({ where: { id: id as any } });
    if (!site) return { message: 'Site not found or already deleted.' };
    await this.siteRepo.delete(id);
    return { message: 'Site deleted successfully.' };
  }
}
