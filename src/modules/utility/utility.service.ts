import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UtilityMeter } from './entities/utility-meter.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { CreateMeterDto } from './dto/create-meter.dto';
import { CreateReadingDto } from './dto/create-reading.dto';
import { Unit } from '../units/entities/unit.entity';
import { Building } from '../buildings/entities/building.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { BuildingAdminAssignment } from '../buildings/entities/building-admin-assignment.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Lease, LeaseStatus } from '../leases/entities/lease.entity';
import { In, DataSource } from 'typeorm';

@Injectable()
export class UtilityService {
  /**
   * Returns units/meters with abnormal consumption (e.g., >2x previous average)
   */
  async getUtilityLeaks() {
    // Find all meters
    const meters = await this.meterRepo.find();
    const leaks: Array<{
      meter_id: string;
      unit_id: string;
      latest_reading: number;
      previous_avg: number;
      spike_ratio: number;
    }> = [];
    for (const meter of meters) {
      // Get last 4 readings (sorted by date desc)
      const readings = await this.readingRepo.find({
        where: { meter_id: meter.id },
        order: { reading_date: 'DESC' },
        take: 4,
      });
      if (readings.length < 2) continue;
      // Calculate average of previous readings (excluding latest)
      const prev = readings.slice(1);
      const prevAvg =
        prev.reduce((sum, r) => sum + Number(r.reading_value), 0) / prev.length;
      const latest = readings[0];
      if (prevAvg > 0 && Number(latest.reading_value) > 2 * prevAvg) {
        // Abnormal spike detected
        leaks.push({
          meter_id: meter.id,
          unit_id: meter.unit_id,
          latest_reading: Number(latest.reading_value),
          previous_avg: prevAvg,
          spike_ratio: Number(latest.reading_value) / prevAvg,
        });
      }
    }
    return leaks;
  }
  constructor(
    @InjectRepository(UtilityMeter)
    private readonly meterRepo: Repository<UtilityMeter>,
    @InjectRepository(MeterReading)
    private readonly readingRepo: Repository<MeterReading>,
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
    private readonly dataSource: DataSource,
  ) {}

  async createMeter(dto: CreateMeterDto, authenticatedUser: any) {
    const userId = authenticatedUser.id || authenticatedUser.sub;
    const roles = await this.getUserRoles(userId);
    if (!roles.includes('super_admin') && !roles.includes('nominee_admin')) {
      throw new ForbiddenException('Only administrators can create meters.');
    }

    // validate unit_id exists and relations
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!dto.unit_id || !uuidRegex.test(dto.unit_id)) {
      throw new BadRequestException('Invalid unit_id format');
    }

    const unit = await this.unitRepo.findOne({ where: { id: dto.unit_id }, relations: ['building', 'building.site'] });
    if (!unit) throw new NotFoundException('Unit not found');

    // If building_id provided ensure unit belongs to that building
    if (dto.building_id && String(unit.building.id) !== String(dto.building_id)) {
      throw new BadRequestException('Provided building_id does not match unit building');
    }

    // If site_id provided ensure building belongs to that site
    if (dto.site_id && String(unit.building.site.id) !== String(dto.site_id)) {
      throw new BadRequestException('Provided site_id does not match unit building site');
    }

    const m = this.meterRepo.create({
      ...dto,
      unit_id: dto.unit_id,
      building_id: dto.building_id || unit.building.id,
      site_id: dto.site_id || unit.building.site.id,
    } as any);

    return this.meterRepo.save(m);
  }

 async findMeters(authenticatedUser?: any, unitId?: string, buildingId?: string, siteId?: string) {
  if (!authenticatedUser) return [];

  const userId = authenticatedUser.id || authenticatedUser.sub;
  const roles = await this.getUserRoles(userId);

  try {
    // Start with a clean query builder on the meter table
    const qb = this.meterRepo.createQueryBuilder('meter');

    // 1. Apply Permission Logic (Restrict view based on Role)
    if (roles.includes('super_admin')) {
      // Super admin can see everything, no initial 'WHERE' needed
    } else if (roles.includes('nominee_admin')) {
      const buildingIds = await this.getUserBuildingIds(userId);
      // Restrict to buildings the admin is assigned to
      qb.andWhere('meter.building_id::text IN (:...buildingIds)', {
        buildingIds: buildingIds.length ? buildingIds : ['none'],
      });
    } else if (roles.includes('tenant')) {
      const tenant = await this.tenantRepo.findOne({ where: { user: { id: userId } } });
      if (!tenant) return [];
      const unitIds = await this.getTenantUnitIds(tenant.id);
      // Restrict to units the tenant has active leases for
      qb.andWhere('meter.unit_id::text IN (:...unitIds)', {
        unitIds: unitIds.length ? unitIds : ['none'],
      });
    } else {
      return []; // Other roles see nothing
    }

    // 2. Apply Optional Query Filters (Filters from the API request)
    // We filter directly on 'meter' columns because they are already populated
    if (unitId) {
      qb.andWhere('meter.unit_id::text = :unitId', { unitId });
    }
    if (buildingId) {
      qb.andWhere('meter.building_id::text = :buildingId', { buildingId });
    }
    if (siteId) {
      qb.andWhere('meter.site_id::text = :siteId', { siteId });
    }

    // Log the generated SQL to the console for debugging if needed
    // console.debug('Generated SQL:', qb.getSql());

    return await qb.getMany();
  } catch (err) {
    console.error('UtilityService.findMeters error', err);
    throw err;
  }
}

  async findMeter(id: string) {
    const m = await this.meterRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Meter not found');
    return m;
  }

  async createReading(dto: CreateReadingDto, authenticatedUser: any) {
    const userId = authenticatedUser.id || authenticatedUser.sub;
    const roles = await this.getUserRoles(userId);
    if (!roles.includes('super_admin') && !roles.includes('nominee_admin')) {
      throw new ForbiddenException(
        'Only administrators can record meter readings.',
      );
    }

    const meter = await this.meterRepo.findOne({ where: { id: dto.meter_id } });
    if (!meter) throw new NotFoundException('Meter not found');
    const readingDate = dto.reading_date
      ? new Date(dto.reading_date)
      : new Date();
    const r: MeterReading = this.readingRepo.create({
      meter_id: dto.meter_id,
      reading_value: dto.reading_value,
      reading_date: readingDate,
      photo_url: dto.photo_url,
    });
    const savedReading: MeterReading = await this.readingRepo.save(r);

    // Find tenant for the unit via active lease
    const activeLease = await this.getActiveLeaseForUnit(meter.unit_id);
    if (activeLease && activeLease.tenant) {
      await this.notificationsService.notify(
        activeLease.tenant.id,
        'New Utility Reading',
        `Your ${meter.type} meter reading of ${dto.reading_value} was recorded on ${readingDate.toLocaleDateString()}.`,
        NotificationType.UTILITY,
        {
          meterId: meter.id,
          readingId: savedReading.id,
          value: dto.reading_value,
          photo: dto.photo_url,
        },
      );

      // Utility Auto-Billing Engine
      const prevReadings = await this.readingRepo.find({
        where: { meter_id: dto.meter_id },
        order: { reading_date: 'DESC' },
        take: 2,
      });

      if (prevReadings.length >= 2) {
        const prev = prevReadings[1];
        const consumption = Number(savedReading.reading_value) - Number(prev.reading_value);
        if (consumption > 0 && meter.unit_price) {
          const amount = consumption * Number(meter.unit_price);
          try {
            const invRepo = this.dataSource.getRepository('invoices');
            const itemRepo = this.dataSource.getRepository('invoice_items');
            const settingsRepo = this.dataSource.getRepository('organization_settings');
             
            const settings = await settingsRepo.findOne({ where: {} }) as any;
            const vatRate = settings ? Number(settings.vat_rate) : 0.15;
            const tax_amount = amount * vatRate;

            const invoice = invRepo.create({
              lease: activeLease,
              tenant: activeLease.tenant,
              unit: activeLease.unit,
              due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              subtotal: amount,
              tax_amount: tax_amount,
              total_amount: amount + tax_amount,
              amount_paid: 0,
              late_fee_amount: 0,
              status: 'pending',
              invoice_no: 'UTL-' + savedReading.id.substring(0, 8).toUpperCase(),
            });
            const savedInvoice = await invRepo.save(invoice);
             
            await itemRepo.save(
              itemRepo.create({
                invoice: savedInvoice,
                type: 'UTILITY',
                amount: amount,
                description: `${meter.type.toUpperCase()} - Consumption: ${consumption} units @ ${meter.unit_price}`
              })
            );
          } catch(err) {
            console.error('Failed to auto-bill utility:', err);
          }
        }
      }
    }
    return savedReading;
  }

  // Helper to get active lease for unit
  private async getActiveLeaseForUnit(unitId: string) {
    return this.leaseRepo.findOne({
      where: { unit: { id: unitId }, status: LeaseStatus.ACTIVE },
      relations: ['tenant', 'unit'],
    });
  }

  async findReadings(authenticatedUser?: any, meterId?: string) {
    if (!authenticatedUser) return [];

    const userId = authenticatedUser.id || authenticatedUser.sub;
    const roles = await this.getUserRoles(userId);

    if (roles.includes('super_admin')) {
      return this.readingRepo.find(
        meterId ? { where: { meter_id: meterId } } : {},
      );
    }

    if (roles.includes('nominee_admin')) {
      const buildingIds = await this.getUserBuildingIds(userId);
      if (buildingIds.length === 0) return [];
      return this.readingRepo
        .createQueryBuilder('reading')
        .innerJoin(UtilityMeter, 'meter', 'meter.id = reading.meter_id')
        .innerJoin(Unit, 'unit', 'unit.id = meter.unit_id')
        .where('unit.building_id IN (:...buildingIds)', { buildingIds })
        .andWhere(meterId ? 'reading.meter_id = :meterId' : '1=1', { meterId })
        .getMany();
    }

    if (roles.includes('tenant')) {
      const meters = await this.findMeters(authenticatedUser);
      if (meters.length === 0) return [];
      const meterIds = meters.map((m) => m.id);
      return this.readingRepo.find({
        where: { meter_id: In(meterIds) },
      });
    }

    return [];
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
    if (!tenantId || tenantId === '') return [];
    const leases = await this.leaseRepo.find({
      where: { tenant: { id: tenantId }, status: LeaseStatus.ACTIVE },
      relations: ['unit'],
    });
    return leases.map((l) => l.unit.id);
  }

  async markAsBilled(readingId: string) {
    const r = await this.readingRepo.findOne({ where: { id: readingId } });
    if (!r) throw new NotFoundException('Reading not found');
    r.is_billed = true;
    return this.readingRepo.save(r);
  }
}
