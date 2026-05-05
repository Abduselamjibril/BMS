import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection } from './entities/inspections.entity';
import { InspectionStatus, InspectionType, ItemCondition } from './entities/inspection.types';
import { InspectionItem } from './entities/inspections.entity';
import { Lease, LeaseStatus } from '../leases/entities/lease.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Owner } from '../owners/entities/owner.entity';
import { Building } from '../buildings/entities/building.entity';


@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(Inspection)
    private inspectionRepo: Repository<Inspection>,
    @InjectRepository(InspectionItem)
    private itemRepo: Repository<InspectionItem>,
    @InjectRepository(Lease)
    private leaseRepo: Repository<Lease>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    @InjectRepository(Owner)
    private ownerRepo: Repository<Owner>,
    @InjectRepository(Building)
    private buildingRepo: Repository<Building>,
  ) {}

  async createInspection(leaseId: string, type: InspectionType) {
    const lease = await this.leaseRepo.findOne({
      where: { id: leaseId },
      relations: ['unit'],
    });
    if (!lease) throw new NotFoundException('Lease not found');

    const inspection = this.inspectionRepo.create({
      lease,
      type,
      status: InspectionStatus.PENDING,
    });
    const saved = await this.inspectionRepo.save(inspection);

    // Seed default items
    const defaultItems = [
      { cat: 'General', name: 'Walls & Paint' },
      { cat: 'General', name: 'Flooring / Carpets' },
      { cat: 'General', name: 'Windows & Blinds' },
      { cat: 'Kitchen', name: 'Cabinets & Counters' },
      { cat: 'Kitchen', name: 'Sink & Faucets' },
      { cat: 'Kitchen', name: 'Appliances' },
      { cat: 'Bathroom', name: 'Toilet & Shower' },
      { cat: 'Bathroom', name: 'Vanity & Mirror' },
      { cat: 'Bedroom', name: 'Closet & Doors' },
      { cat: 'Utilities', name: 'Lights & Switches' },
      { cat: 'Utilities', name: 'Outlets' },
      { cat: 'Utilities', name: 'AC / Heating' },
    ];

    const itemEntities = defaultItems.map((d) =>
      this.itemRepo.create({
        inspection: saved,
        room_category: d.cat,
        item_name: d.name,
        condition: ItemCondition.GOOD,
      }),
    );
    await this.itemRepo.save(itemEntities);

    return this.getInspection(saved.id);
  }

  async getInspection(id: string, authenticatedUser?: any) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id },
      relations: ['items', 'lease', 'lease.unit', 'lease.unit.building', 'lease.unit.building.owner', 'lease.tenant'],
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    if (authenticatedUser) {
      const userId = authenticatedUser.id || authenticatedUser.sub;
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: userId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map(r => r.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({ where: { user: { id: userId } } });
        if (!owner || inspection.lease.unit.building.owner.id !== owner.id) {
          throw new ForbiddenException('You do not have access to this inspection');
        }
      }
    }

    return inspection;
  }

  async getMyPendingInspection(userId: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!tenant) throw new NotFoundException('Tenant profile not found');

    const lease = await this.leaseRepo.findOne({
      where: { tenant: { id: tenant.id }, status: LeaseStatus.ACTIVE },
    });
    if (!lease) return null;

    return this.inspectionRepo.findOne({
      where: {
        lease: { id: lease.id },
        status: InspectionStatus.PENDING,
      },
      relations: ['items', 'lease', 'lease.unit'],
      order: { created_at: 'DESC' },
    });
  }

  async updateItem(itemId: string, dto: { condition?: ItemCondition; comment?: string; photos?: string[] }, authenticatedUser?: any) {
    const item = await this.itemRepo.findOne({ 
      where: { id: itemId },
      relations: ['inspection', 'inspection.lease', 'inspection.lease.unit', 'inspection.lease.unit.building', 'inspection.lease.unit.building.owner']
    });
    if (!item) throw new NotFoundException('Item not found');

    if (authenticatedUser) {
      const userId = authenticatedUser.id || authenticatedUser.sub;
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: userId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map(r => r.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({ where: { user: { id: userId } } });
        if (!owner || item.inspection.lease.unit.building.owner.id !== owner.id) {
          throw new ForbiddenException('You do not have access to this inspection item');
        }
      }
    }

    if (dto.condition) item.condition = dto.condition;
    if (dto.comment !== undefined) item.comment = dto.comment;
    if (dto.photos) item.photos = dto.photos;

    return this.itemRepo.save(item);
  }

  async submitInspection(id: string, signatureUrl?: string, notes?: string, authenticatedUser?: any) {
    const inspection = await this.getInspection(id, authenticatedUser);
    if (inspection.status !== InspectionStatus.PENDING) {
      throw new BadRequestException('Inspection is not in PENDING status');
    }

    inspection.status = InspectionStatus.SUBMITTED;
    if (signatureUrl) inspection.tenant_signature = signatureUrl;
    if (notes) inspection.notes = notes;

    return this.inspectionRepo.save(inspection);
  }

  async verifyInspection(id: string, admin: any) {
    const inspection = await this.getInspection(id, admin);
    inspection.status = InspectionStatus.VERIFIED;
    inspection.verified_by = admin;
    inspection.verified_at = new Date();
    return this.inspectionRepo.save(inspection);
  }
}
