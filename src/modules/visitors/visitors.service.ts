import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Visitor } from './entities/visitor.entity';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { Site } from '../sites/entities/site.entity';
import { Unit } from '../units/entities/unit.entity';
import { VisitorStatus } from './entities/visitor.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { BuildingAdminAssignment } from '../buildings/entities/building-admin-assignment.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Lease, LeaseStatus } from '../leases/entities/lease.entity';

@Injectable()
export class VisitorsService {
  constructor(
    @InjectRepository(Visitor)
    private readonly visitorRepo: Repository<Visitor>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(BuildingAdminAssignment)
    private readonly adminAssignmentRepo: Repository<BuildingAdminAssignment>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateVisitorDto, authenticatedUser?: any) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!dto.site_id || !uuidRegex.test(dto.site_id)) {
      throw new BadRequestException('Invalid site_id format');
    }

    const site = await this.siteRepo.findOne({ where: { id: dto.site_id } });
    if (!site) throw new NotFoundException('Site not found');

    if (dto.unit_id) {
      if (!uuidRegex.test(dto.unit_id)) {
        throw new BadRequestException('Invalid unit_id format');
      }
      const unit = await this.unitRepo.findOne({
        where: { id: dto.unit_id },
        relations: ['building', 'building.site'] as any,
      });
      if (!unit) throw new NotFoundException('Unit not found');

      const unitSiteId =
        unit.building && unit.building.site
          ? (unit.building.site as any).id
          : null;
      if (!unitSiteId || unitSiteId !== dto.site_id) {
        throw new BadRequestException('Unit does not belong to the given site');
      }

      if (authenticatedUser) {
        const roles = await this.getUserRoles(
          authenticatedUser.id || authenticatedUser.sub,
        );
        if (roles.includes('tenant')) {
          const tenant = await this.tenantRepo.findOne({
            where: {
              user: { id: authenticatedUser.id || authenticatedUser.sub },
            },
          });
          const tenantUnitIds = await this.getTenantUnitIds(tenant?.id || '');
          if (!tenantUnitIds.includes(dto.unit_id)) {
            throw new ForbiddenException(
              'You can only check-in visitors for your own unit',
            );
          }
          dto.host_user_id = authenticatedUser.id || authenticatedUser.sub;
        }
      }
    }

    const v: Visitor = this.visitorRepo.create({
      ...dto,
      check_in_time: new Date(),
      status: VisitorStatus.IN,
    });
    const savedVisitor: Visitor = await this.visitorRepo.save(v);

    if (dto.unit_id) {
      const lease = await this.leaseRepo.findOne({
        where: { unit: { id: dto.unit_id }, status: LeaseStatus.ACTIVE },
        relations: ['tenant'],
      });
      if (lease && lease.tenant) {
        await this.notificationsService.notify(
          lease.tenant.id,
          'Visitor Check-In',
          `Visitor ${dto.visitor_name} has checked in to see you.`,
          NotificationType.VISITOR,
          {
            visitorId: savedVisitor.id,
            unitId: dto.unit_id,
            siteId: dto.site_id,
          },
        );
      }
    }
    return savedVisitor;
  }

  async findAll(authenticatedUser?: any, siteId?: string) {
    if (!authenticatedUser) return [];

    const userId = authenticatedUser.id || authenticatedUser.sub;
    const roles = await this.getUserRoles(userId);

    if (roles.includes('super_admin') || roles.includes('admin')) {
      return this.visitorRepo.find(
        siteId ? { where: { site_id: siteId } } : {},
      );
    }

    if (roles.includes('site_admin') || roles.includes('nominee_admin')) {
      const assignments = await this.adminAssignmentRepo.find({
        where: { user: { id: userId } },
        relations: ['building', 'building.site'],
      });
      const buildingIds = assignments.map((a) => a.building.id);
      const siteIds = assignments
        .map((a) => (a.building.site as any)?.id)
        .filter((id) => !!id);

      return this.visitorRepo
        .createQueryBuilder('visitor')
        .where('visitor.site_id::uuid IN (:...siteIds)', {
          siteIds: siteIds.length ? siteIds : [ '00000000-0000-0000-0000-000000000000' ],
        })
        .orWhere('visitor.unit_id::uuid IN (SELECT u.id FROM units u WHERE u.building_id IN (:...buildingIds))', {
          buildingIds: buildingIds.length ? buildingIds : [ '00000000-0000-0000-0000-000000000000' ],
        })
        .orWhere('visitor.host_user_id = :userId', { userId })
        .getMany();
    }

    if (roles.includes('tenant')) {
      const tenant = await this.tenantRepo.findOne({
        where: { user: { id: userId } },
      });
      const unitIds = await this.getTenantUnitIds(tenant?.id || '');
      return this.visitorRepo.find({
        where: [
          { host_user_id: userId },
          { unit_id: In(unitIds.length ? unitIds : ['none']) as any },
        ],
      });
    }

    return [];
  }

  async findOne(id: string, authenticatedUser?: any) {
    const v = await this.visitorRepo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Visitor not found');

    if (authenticatedUser) {
      const userId = authenticatedUser.id || authenticatedUser.sub;
      const roles = await this.getUserRoles(userId);
      if (roles.includes('super_admin') || roles.includes('admin')) return v;

      if (roles.includes('tenant')) {
        const tenant = await this.tenantRepo.findOne({
          where: { user: { id: userId } },
        });
        const unitIds = await this.getTenantUnitIds(tenant?.id || '');
        if (v.host_user_id !== userId && !unitIds.includes(v.unit_id as any)) {
          throw new ForbiddenException('Access denied');
        }
      }

      if (roles.includes('site_admin') || roles.includes('nominee_admin')) {
        const buildingIds = await this.getUserBuildingIds(userId);
        // Additional check for site/nominee admin can be added here
      }
    }
    return v;
  }

  async update(id: string, dto: UpdateVisitorDto, authenticatedUser?: any) {
    const v = await this.findOne(id, authenticatedUser);
    Object.assign(v, dto);
    return this.visitorRepo.save(v);
  }

  async checkOut(id: string, authenticatedUser?: any) {
    const v = await this.findOne(id, authenticatedUser);
    v.check_out_time = new Date();
    v.status = 'exited' as any;
    return this.visitorRepo.save(v);
  }

  async remove(id: string, authenticatedUser?: any) {
    await this.findOne(id, authenticatedUser);
    await this.visitorRepo.delete(id);
    return { message: 'Deleted' };
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    const roles = await this.userRoleRepo.find({
      where: { user: { id: userId } },
      relations: ['role'],
    });
    return roles.map((r) => r.role.name);
  }

  private async getUserBuildingIds(userId: string): Promise<string[]> {
    const assignments = await this.adminAssignmentRepo.find({
      where: { user: { id: userId } },
      relations: ['building'],
    });
    return assignments.map((x) => x.building.id);
  }

  private async getTenantUnitIds(tenantId: string): Promise<string[]> {
    const leases = await this.leaseRepo.find({
      where: { tenant: { id: tenantId }, status: LeaseStatus.ACTIVE },
      relations: ['unit'],
    });
    return leases.map((l) => l.unit.id);
  }
}
