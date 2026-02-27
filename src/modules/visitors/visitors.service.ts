import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visitor } from './entities/visitor.entity';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { Site } from '../sites/entities/site.entity';
import { Unit } from '../units/entities/unit.entity';
import { VisitorStatus } from './entities/visitor.entity';

@Injectable()
export class VisitorsService {
  constructor(
    @InjectRepository(Visitor)
    private readonly visitorRepo: Repository<Visitor>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(require('../leases/entities/lease.entity').Lease)
    private readonly leaseRepository: Repository<any>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateVisitorDto) {
    // Basic UUID format validation to avoid DB UUID parse errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!dto.site_id || !uuidRegex.test(dto.site_id)) {
      throw new BadRequestException('Invalid site_id format');
    }

    // Validate site exists
    const site = await this.siteRepo.findOne({ where: { id: dto.site_id } });
    if (!site) throw new NotFoundException('Site not found');

    // If unit_id provided, validate unit exists and belongs to the site
    if (dto.unit_id) {
      if (!uuidRegex.test(dto.unit_id)) {
        throw new BadRequestException('Invalid unit_id format');
      }
      const unit = await this.unitRepo.findOne({ where: { id: dto.unit_id }, relations: ['building', 'building.site'] as any });
      if (!unit) throw new NotFoundException('Unit not found');
      const unitSiteId = unit.building && unit.building.site ? (unit.building.site as any).id : null;
      if (!unitSiteId || unitSiteId !== dto.site_id) {
        throw new BadRequestException('Unit does not belong to the given site');
      }
    }

    const v: Visitor = this.visitorRepo.create({
      ...dto,
      check_in_time: new Date(),
      status: VisitorStatus.IN,
    });
    const savedVisitor: Visitor = await this.visitorRepo.save(v);

    // Notify tenant if unit_id is provided
    if (dto.unit_id) {
      // Find tenant for the unit via active lease
      const lease = await this.leaseRepository.findOne({ where: { unit: { id: dto.unit_id }, status: 'active' }, relations: ['tenant'] });
      if (lease && lease.tenant) {
        await this.notificationsService.notify(
          lease.tenant.id,
          'Visitor Check-In',
          `Visitor ${dto.visitor_name} has checked in to see you.`,
          NotificationType.VISITOR,
          { visitorId: savedVisitor.id, unitId: dto.unit_id, siteId: dto.site_id }
        );
      }
    }
    return savedVisitor;
  }

  findAll(siteId?: string) {
    const where = siteId ? { where: { site_id: siteId } } : {};
    // @ts-ignore
    return this.visitorRepo.find(where);
  }

  async findOne(id: string) {
    const v = await this.visitorRepo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Visitor not found');
    return v;
  }

  async update(id: string, dto: UpdateVisitorDto) {
    const v = await this.findOne(id);
    Object.assign(v, dto);
    return this.visitorRepo.save(v);
  }

  async checkOut(id: string) {
    const v = await this.findOne(id);
    v.check_out_time = new Date();
    v.status = 'exited' as any;
    return this.visitorRepo.save(v);
  }

  async remove(id: string) {
    const v = await this.findOne(id);
    await this.visitorRepo.delete(id);
    return { message: 'Deleted' };
  }
}
