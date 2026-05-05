import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './entities/site.entity';
import { Building } from '../buildings/entities/building.entity';
import { Owner } from '../owners/entities/owner.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Owner)
    private readonly ownerRepo: Repository<Owner>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
  ) {}

  async create(dto: Partial<Site>): Promise<Site> {
    const site = this.siteRepo.create(dto);
    return this.siteRepo.save(site);
  }

  async findAll(authenticatedUser?: any): Promise<Site[]> {
    const qb = this.siteRepo.createQueryBuilder('site')
      .leftJoinAndSelect('site.buildings', 'buildings')
      .leftJoinAndSelect('site.manager', 'manager');

    if (authenticatedUser) {
      const currentUserId = authenticatedUser.id || authenticatedUser.sub;
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: currentUserId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map((ur) => ur.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({ where: { user: { id: currentUserId } } });
        if (!owner) return [];

        // Filter sites that have buildings owned by this owner
        qb.innerJoin('site.buildings', 'b_owner')
          .andWhere('b_owner.ownerId = :oid', { oid: owner.id });
      }
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Site | null> {
    // Note: Use "id: id as any" if your Entity ID is a number but your param is a string
    return this.siteRepo.findOne({
      where: { id: id as any },
      relations: ['buildings', 'manager'],
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
