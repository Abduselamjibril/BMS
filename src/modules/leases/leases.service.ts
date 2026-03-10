import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Lease, LeaseStatus } from './entities/lease.entity';
import { Unit, UnitStatus } from '../units/entities/unit.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Building } from '../buildings/entities/building.entity';
import { TenantDocument, TenantDocumentType } from '../tenants/entities/tenant-document.entity';
import {
  OccupancyStatus,
  UnitOccupancyHistory,
} from './entities/unit-occupancy-history.entity';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { BuildingAdminAssignment } from '../buildings/entities/building-admin-assignment.entity';
// RoleName enum removed
import { UserRole } from '../roles/entities/user-role.entity';
import { LeasePdfService } from './services/lease-pdf.service';

@Injectable()
export class LeasesService {
  constructor(
    @InjectRepository(Lease)
    private readonly leaseRepository: Repository<Lease>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(TenantDocument)
    private readonly tenantDocumentRepository: Repository<TenantDocument>,
    @InjectRepository(UnitOccupancyHistory)
    private readonly occupancyRepository: Repository<UnitOccupancyHistory>,
    @InjectRepository(BuildingAdminAssignment)
    private readonly buildingAssignmentRepository: Repository<BuildingAdminAssignment>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly dataSource: DataSource,
    private readonly leasePdfService: LeasePdfService,
  ) { }

  private normalizeId(raw?: string): string {
    if (!raw) return raw as unknown as string;
    return raw.replace(/^\s+|\s+$/g, '').replace(/^"|"$/g, '');
  }
  private isDateOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return aStart <= bEnd && bStart <= aEnd;
  }

  private async ensureNoOverlap(unitId: string, startDate: string, endDate: string, excludeLeaseId?: string) {
    const blockingLeases = await this.leaseRepository.find({
      where: {
        unit: { id: unitId },
        status: In([LeaseStatus.DRAFT, LeaseStatus.ACTIVE, LeaseStatus.RENEWED]),
      },
      relations: ['unit'],
    });

    const hasOverlap = blockingLeases.some((lease) => {
      if (excludeLeaseId && lease.id === excludeLeaseId) return false;
      return this.isDateOverlap(startDate, endDate, lease.start_date, lease.end_date);
    });

    if (hasOverlap) {
      throw new ConflictException('Lease dates overlap with an existing lease for this unit');
    }
  }

  private generateLeaseNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 9000 + 1000);
    return `L-${timestamp}-${random}`;
  }

  async create(dto: CreateLeaseDto): Promise<Lease> {
    if (dto.start_date > dto.end_date) {
      throw new BadRequestException('start_date must be less than or equal to end_date');
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: dto.tenant_id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const unit = await this.unitRepository.findOne({ where: { id: dto.unit_id }, relations: ['building'] });
    if (!unit) throw new NotFoundException('Unit not found');

    const building = await this.buildingRepository.findOne({ where: { id: dto.building_id } });
    if (!building) throw new NotFoundException('Building not found');

    if (unit.building.id !== building.id) {
      throw new BadRequestException('Unit does not belong to building');
    }

    if (unit.status !== UnitStatus.VACANT) {
      throw new BadRequestException('Unit must be vacant to create lease draft');
    }

    await this.ensureNoOverlap(unit.id, dto.start_date, dto.end_date);

    const lease = this.leaseRepository.create({
      lease_number: this.generateLeaseNumber(),
      tenant,
      unit,
      building,
      start_date: dto.start_date,
      end_date: dto.end_date,
      rent_amount: dto.rent_amount,
      service_charge: dto.service_charge ?? 0,
      billing_cycle: dto.billing_cycle,
      status: LeaseStatus.DRAFT,
      doc_path: dto.doc_path,
    });

    return this.leaseRepository.save(lease);
  }

  async findAll(currentUserId: string, expiringSoon?: boolean, status?: string): Promise<Lease[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { user: { id: currentUserId } },
      relations: ['role'],
    });

    const isNominee = userRoles.some((ur) => ur.role.name === 'nominee_admin');

    const query = this.leaseRepository
      .createQueryBuilder('lease')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .leftJoinAndSelect('lease.unit', 'unit')
      .leftJoinAndSelect('lease.building', 'building')
      .orderBy('lease.created_at', 'DESC');

    if (isNominee) {
      const assignments = await this.buildingAssignmentRepository.find({
        where: { user: { id: currentUserId } },
        relations: ['building'],
      });
      const buildingIds = assignments.map((item) => item.building.id);
      if (buildingIds.length === 0) return [];
      query.andWhere('lease.building_id IN (:...buildingIds)', { buildingIds });
    }

    if (expiringSoon) {
      const now = new Date();
      const plus30 = new Date();
      plus30.setDate(now.getDate() + 30);
      const start = now.toISOString().split('T')[0];
      const end = plus30.toISOString().split('T')[0];
      query.andWhere('lease.end_date BETWEEN :start AND :end', { start, end });
      query.andWhere('lease.status = :activeStatus', { activeStatus: LeaseStatus.ACTIVE });
    }

    if (status) {
      query.andWhere('lease.status = :status', { status: status.toUpperCase() });
    }

    return query.getMany();
  }

  async activate(id: string): Promise<Lease> {
    const cleanId = this.normalizeId(id);
    const lease = await this.leaseRepository.findOne({
      where: { id: cleanId },
      relations: ['tenant', 'unit', 'building'],
    });
    if (!lease) throw new NotFoundException('Lease not found');

    if (lease.status !== LeaseStatus.DRAFT) {
      throw new BadRequestException('Only draft leases can be activated');
    }

    await this.ensureNoOverlap(lease.unit.id, lease.start_date, lease.end_date, lease.id);

    const unit = await this.unitRepository.findOne({ where: { id: lease.unit.id } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status !== UnitStatus.VACANT) {
      throw new ConflictException('Unit is already occupied or unavailable');
    }

    const primaryId = await this.tenantDocumentRepository.findOne({
      where: {
        tenant: { id: lease.tenant.id },
        type: TenantDocumentType.PRIMARY_ID,
        verified: true,
      },
      relations: ['tenant'],
    });

    if (!primaryId) {
      throw new BadRequestException('Tenant primary ID must be verified before activation');
    }

    await this.dataSource.transaction(async (manager) => {
      lease.status = LeaseStatus.ACTIVE;
      await manager.getRepository(Lease).save(lease);

      unit.status = UnitStatus.OCCUPIED;
      await manager.getRepository(Unit).save(unit);

      const occupancy = manager.getRepository(UnitOccupancyHistory).create({
        unit,
        tenant: lease.tenant,
        start_date: lease.start_date,
        status: OccupancyStatus.CURRENT,
      });
      await manager.getRepository(UnitOccupancyHistory).save(occupancy);
    });

    return this.leaseRepository.findOne({
      where: { id: lease.id },
      relations: ['tenant', 'unit', 'building'],
    }) as Promise<Lease>;
  }

  async terminate(id: string, dto: TerminateLeaseDto): Promise<Lease> {
    const cleanId = this.normalizeId(id);
    const lease = await this.leaseRepository.findOne({
      where: { id: cleanId },
      relations: ['tenant', 'unit', 'building'],
    });
    if (!lease) throw new NotFoundException('Lease not found');

    if (![LeaseStatus.ACTIVE, LeaseStatus.RENEWED].includes(lease.status)) {
      throw new BadRequestException('Only active/renewed leases can be terminated');
    }

    const terminationDate = dto.termination_date ?? new Date().toISOString().split('T')[0];

    await this.dataSource.transaction(async (manager) => {
      lease.status = LeaseStatus.TERMINATED;
      lease.end_date = terminationDate;
      await manager.getRepository(Lease).save(lease);

      const unit = await manager.getRepository(Unit).findOne({ where: { id: lease.unit.id } });
      if (!unit) throw new NotFoundException('Unit not found');
      unit.status = UnitStatus.VACANT;
      await manager.getRepository(Unit).save(unit);

      const currentOccupancy = await manager.getRepository(UnitOccupancyHistory).findOne({
        where: {
          unit: { id: lease.unit.id },
          tenant: { id: lease.tenant.id },
          status: OccupancyStatus.CURRENT,
        },
        relations: ['unit', 'tenant'],
        order: { created_at: 'DESC' },
      });

      if (currentOccupancy) {
        currentOccupancy.end_date = terminationDate;
        currentOccupancy.status = OccupancyStatus.PREVIOUS;
        await manager.getRepository(UnitOccupancyHistory).save(currentOccupancy);
      }
    });

    return this.leaseRepository.findOne({ where: { id }, relations: ['tenant', 'unit', 'building'] }) as Promise<Lease>;
  }

  async renew(id: string, dto: RenewLeaseDto): Promise<Lease> {
    const cleanId = this.normalizeId(id);
    const currentLease = await this.leaseRepository.findOne({
      where: { id: cleanId },
      relations: ['tenant', 'unit', 'building'],
    });
    if (!currentLease) throw new NotFoundException('Lease not found');

    if (![LeaseStatus.ACTIVE, LeaseStatus.EXPIRED].includes(currentLease.status)) {
      throw new BadRequestException('Only active or expired lease can be renewed');
    }

    if (dto.start_date > dto.end_date) {
      throw new BadRequestException('start_date must be <= end_date');
    }

    await this.ensureNoOverlap(currentLease.unit.id, dto.start_date, dto.end_date);

    const renewedLease = this.leaseRepository.create({
      lease_number: this.generateLeaseNumber(),
      tenant: currentLease.tenant,
      unit: currentLease.unit,
      building: currentLease.building,
      start_date: dto.start_date,
      end_date: dto.end_date,
      rent_amount: dto.rent_amount,
      service_charge: dto.service_charge ?? currentLease.service_charge,
      billing_cycle: dto.billing_cycle ?? currentLease.billing_cycle,
      status: LeaseStatus.DRAFT,
      previous_lease: currentLease,
    });

    currentLease.status = LeaseStatus.RENEWED;
    await this.leaseRepository.save(currentLease);

    return this.leaseRepository.save(renewedLease);
  }

  async uploadLeaseDocument(id: string, docPath: string): Promise<Lease> {
    const cleanId = this.normalizeId(id);
    const lease = await this.leaseRepository.findOne({ where: { id: cleanId } });
    if (!lease) throw new NotFoundException('Lease not found');
    lease.doc_path = docPath;
    return this.leaseRepository.save(lease);
  }

  async downloadLeasePdf(id: string): Promise<Buffer> {
    const cleanId = this.normalizeId(id);
    const lease = await this.leaseRepository.findOne({
      where: { id: cleanId },
      relations: ['tenant', 'unit', 'building'],
    });
    if (!lease) throw new NotFoundException('Lease not found');

    return this.leasePdfService.generateLeasePdf({
      lease_number: lease.lease_number,
      tenant_name: `${lease.tenant.first_name} ${lease.tenant.last_name}`,
      unit_number: lease.unit.unit_number,
      building_name: lease.building.name,
      start_date: lease.start_date,
      end_date: lease.end_date,
      rent_amount: Number(lease.rent_amount),
      service_charge: Number(lease.service_charge),
    });
  }

  async occupancyReport(): Promise<UnitOccupancyHistory[]> {
    return this.occupancyRepository.find({
      relations: ['unit', 'tenant'],
      order: { created_at: 'DESC' },
    });
  }

  async runMidnightAutomation(): Promise<{ reminders: number; expired: number }> {
    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];

    const activeLeases = await this.leaseRepository.find({
      where: { status: LeaseStatus.ACTIVE },
      relations: ['unit', 'tenant'],
    });

    let reminders = 0;
    let expired = 0;

    for (const lease of activeLeases) {
      const endDate = new Date(`${lease.end_date}T00:00:00`);
      const diffDays = Math.floor((endDate.getTime() - new Date(`${todayDate}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24));

      if ([30, 20, 7].includes(diffDays)) {
        reminders += 1;
      }

      if (lease.end_date < todayDate) {
        lease.status = LeaseStatus.EXPIRED;
        await this.leaseRepository.save(lease);

        const unit = await this.unitRepository.findOne({ where: { id: lease.unit.id } });
        if (unit) {
          unit.status = UnitStatus.VACANT;
          await this.unitRepository.save(unit);
        }

        const currentOccupancy = await this.occupancyRepository.findOne({
          where: {
            unit: { id: lease.unit.id },
            tenant: { id: lease.tenant.id },
            status: OccupancyStatus.CURRENT,
          },
          relations: ['unit', 'tenant'],
          order: { created_at: 'DESC' },
        });

        if (currentOccupancy) {
          currentOccupancy.end_date = lease.end_date;
          currentOccupancy.status = OccupancyStatus.PREVIOUS;
          await this.occupancyRepository.save(currentOccupancy);
        }

        expired += 1;
      }
    }

    return { reminders, expired };
  }
}
