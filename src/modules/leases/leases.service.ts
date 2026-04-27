import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Lease, LeaseStatus, DepositStatus } from './entities/lease.entity';
import { LeasePayment, LeasePaymentStatus } from './entities/lease-payment.entity';
import { Unit, UnitStatus } from '../units/entities/unit.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Building } from '../buildings/entities/building.entity';
import { OrganizationSettings } from '../settings/entities/organization-settings.entity';
import {
  TenantDocument,
  TenantDocumentType,
} from '../tenants/entities/tenant-document.entity';
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
import { User } from '../users/entities/user.entity';
import { ManagementAssignment, ManagementScope } from '../management/entities/management-assignment.entity';
import { LeasePdfService } from './services/lease-pdf.service';
import { FinanceService } from '../finance/finance.service';
import { InvoiceItemType } from '../finance/entities/invoice-item.entity';
import { CommissionCalculationService } from '../commission/services/commission-calculation.service';
import { CommissionBasis } from '../commission/entities/commission-rule.entity';

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
    @InjectRepository(OrganizationSettings)
    private readonly orgSettingsRepository: Repository<OrganizationSettings>,
    @InjectRepository(LeasePayment)
    private readonly leasePaymentRepository: Repository<LeasePayment>,
    private readonly dataSource: DataSource,
    private readonly leasePdfService: LeasePdfService,

    @Inject(forwardRef(() => FinanceService))
    private readonly financeService: FinanceService,
    private readonly commissionCalculationService: CommissionCalculationService,
  ) { }


  private normalizeId(raw?: string): string {
    if (!raw) return raw as unknown as string;
    return raw.replace(/^\s+|\s+$/g, '').replace(/^"|"$/g, '');
  }
  private isDateOverlap(
    aStart: string,
    aEnd: string,
    bStart: string,
    bEnd: string,
  ): boolean {
    return aStart <= bEnd && bStart <= aEnd;
  }

  private async ensureNoOverlap(
    unitId: string,
    startDate: string,
    endDate: string,
    excludeLeaseId?: string,
  ) {
    const blockingLeases = await this.leaseRepository.find({
      where: {
        unit: { id: unitId },
        status: In([
          LeaseStatus.DRAFT,
          LeaseStatus.ACTIVE,
          LeaseStatus.RENEWED,
        ]),
      },
      relations: ['unit'],
    });

    const hasOverlap = blockingLeases.some((lease) => {
      if (excludeLeaseId && lease.id === excludeLeaseId) return false;
      return this.isDateOverlap(
        startDate,
        endDate,
        lease.start_date,
        lease.end_date,
      );
    });

    if (hasOverlap) {
      throw new ConflictException(
        'Lease dates overlap with an existing lease for this unit',
      );
    }
  }

  private generateLeaseNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 9000 + 1000);
    return `L-${timestamp}-${random}`;
  }

  async create(dto: CreateLeaseDto): Promise<Lease> {
    if (dto.start_date > dto.end_date) {
      throw new BadRequestException(
        'start_date must be less than or equal to end_date',
      );
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: dto.tenant_id },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const unit = await this.unitRepository.findOne({
      where: { id: dto.unit_id },
      relations: ['building'],
    });
    if (!unit) throw new NotFoundException('Unit not found');

    const building = await this.buildingRepository.findOne({
      where: { id: dto.building_id },
    });
    if (!building) throw new NotFoundException('Building not found');

    if (unit.building.id !== building.id) {
      throw new BadRequestException('Unit does not belong to building');
    }

    if (unit.status !== UnitStatus.VACANT) {
      throw new BadRequestException(
        'Unit must be vacant to create lease draft',
      );
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
      deposit_amount: dto.deposit_amount ?? 0,
      deposit_status: DepositStatus.HELD,
      doc_path: dto.doc_path,
    });

    return this.leaseRepository.save(lease);
  }

  async findAll(
    currentUserId: string,
    expiringSoon?: boolean,
    status?: string,
    tenant_id?: string,
  ): Promise<Lease[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { user: { id: currentUserId } },
      relations: ['role'],
    });

    const isNominee = userRoles.some((ur) => ur.role.name === 'nominee_admin');
    const isTenant = userRoles.some((ur) => ur.role.name === 'tenant');
    const isSuperAdmin = userRoles.some((ur) => ur.role.name === 'super_admin');

    const query = this.leaseRepository
      .createQueryBuilder('lease')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .leftJoinAndSelect('lease.unit', 'unit')
      .leftJoinAndSelect('lease.building', 'building')
      .orderBy('lease.created_at', 'DESC');

    // 1. Super Admin: No filters
    if (isSuperAdmin) {
      // no-op
    }
    // 2. Nominee Admin: Filter by assigned buildings/units
    else if (isNominee) {
      const buildingIds: string[] = [];
      const unitIds: string[] = [];

      // Legacy assignments
      const assignments = await this.buildingAssignmentRepository.find({
        where: { user: { id: currentUserId } },
        relations: ['building'],
      });
      assignments.forEach((item) => buildingIds.push(item.building.id));

      // Management Company assignments
      const user = await this.dataSource.getRepository(User).findOne({
        where: { id: currentUserId },
      });

      if (user?.company_id) {
        const mgmtAssignments = await this.dataSource
          .getRepository(ManagementAssignment)
          .find({
            where: { company_id: user.company_id, is_active: true },
          });
        
        for (const ma of mgmtAssignments) {
          if (ma.scope_type === ManagementScope.BUILDING && ma.building_id) {
            buildingIds.push(ma.building_id);
          } else if (ma.scope_type === ManagementScope.UNIT && ma.unit_id) {
            unitIds.push(ma.unit_id);
          }
        }
      }

      if (buildingIds.length > 0 || unitIds.length > 0) {
        if (buildingIds.length > 0 && unitIds.length > 0) {
          query.andWhere('(lease.building_id IN (:...buildingIds) OR lease.unit_id IN (:...unitIds))', { buildingIds: [...new Set(buildingIds)], unitIds: [...new Set(unitIds)] });
        } else if (buildingIds.length > 0) {
          query.andWhere('lease.building_id IN (:...buildingIds)', { buildingIds: [...new Set(buildingIds)] });
        } else {
          query.andWhere('lease.unit_id IN (:...unitIds)', { unitIds: [...new Set(unitIds)] });
        }
      } else {
        return [];
      }
    }
    // 3. Tenant: Filter by their own tenant record
    else if (isTenant) {
      const tenantRecord = await this.tenantRepository.findOne({
        where: { user: { id: currentUserId } },
      });
      if (!tenantRecord) return [];
      query.andWhere('lease.tenant_id = :userTenantId', {
        userTenantId: tenantRecord.id,
      });
    }
    // 4. Default fallback: If no specific role handling matched, return empty or limit (security)
    else {
      // If they are regular admin or similar, maybe they should see everything?
      // depends on the architecture, but usually 'admin' sees all unless explicitly nominee.
    }

    if (tenant_id) {
      query.andWhere('lease.tenant_id = :tenantId', { tenantId: tenant_id });
    }

    if (expiringSoon) {
      const now = new Date();
      const plus30 = new Date();
      plus30.setDate(now.getDate() + 30);
      const start = now.toISOString().split('T')[0];
      const end = plus30.toISOString().split('T')[0];
      query.andWhere('lease.end_date BETWEEN :start AND :end', { start, end });
      query.andWhere('lease.status = :activeStatus', {
        activeStatus: LeaseStatus.ACTIVE,
      });
    }

    if (status) {
      query.andWhere('lease.status = :status', {
        status: status.toUpperCase(),
      });
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

    await this.ensureNoOverlap(
      lease.unit.id,
      lease.start_date,
      lease.end_date,
      lease.id,
    );

    const unit = await this.unitRepository.findOne({
      where: { id: lease.unit.id },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status !== UnitStatus.VACANT) {
      throw new ConflictException('Unit is already occupied or unavailable');
    }

    const primaryId = await this.tenantDocumentRepository.findOne({
      where: {
        tenant: { id: lease.tenant.id },
        type: In([
          TenantDocumentType.PRIMARY_ID,
          TenantDocumentType.PASSPORT,
          TenantDocumentType.ID,
        ]),
        verified: true,
      },
      relations: ['tenant'],
    });

    if (!primaryId) {
      throw new BadRequestException(
        'Tenant must have a verified ID or Passport before activation',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      lease.status = LeaseStatus.ACTIVE;
      lease.next_billing_date = lease.start_date;
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

      // --- COMMISSION HOOK ---
      // Trigger commission for lease signing if managed by a company
      if (lease.managed_by_company_id) {
        await this.commissionCalculationService.calculateFromSource(
          CommissionBasis.LEASE,
          lease.id,
          Number(lease.rent_amount),
          lease.managed_by_company_id,
          lease.building_id,
        );
      }
      // -----------------------
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
      throw new BadRequestException(
        'Only active/renewed leases can be terminated',
      );
    }

    const terminationDate =
      dto.termination_date ?? new Date().toISOString().split('T')[0];

    const settings = await this.orgSettingsRepository.find();
    const penaltyPct = settings[0]?.early_termination_penalty_pct ?? 0;

    const end = new Date(lease.end_date);
    const term = new Date(terminationDate);
    const monthsLeft = Math.max(0, (end.getFullYear() - term.getFullYear()) * 12 + (end.getMonth() - term.getMonth()));

    let penaltyAmount = 0;
    if (monthsLeft > 0 && penaltyPct > 0) {
      penaltyAmount = monthsLeft * Number(lease.rent_amount) * (Number(penaltyPct) / 100);
    }

    let depositRefund: number | undefined = undefined;
    let newDepositStatus = lease.deposit_status;

    const totalHeld = Number(lease.deposit_amount) + Number(lease.advance_balance || 0);

    if (dto.deposit_deduction !== undefined || penaltyAmount > 0 || Number(lease.advance_balance) > 0) {
      const deduction = Number(dto.deposit_deduction || 0);
      const refund = Math.max(0, totalHeld - deduction - penaltyAmount);
      depositRefund = refund;
      newDepositStatus = refund > 0 && refund < totalHeld ? DepositStatus.PARTIALLY_REFUNDED : DepositStatus.REFUNDED;
    }

    await this.dataSource.transaction(async (manager) => {
      lease.status = LeaseStatus.TERMINATED;
      lease.end_date = terminationDate;
      lease.penalty_amount = penaltyAmount;
      if (depositRefund !== undefined) {
        lease.deposit_refund_amount = depositRefund;
        lease.deposit_refund_date = new Date().toISOString().split('T')[0];
        lease.deposit_status = newDepositStatus;
        lease.advance_balance = 0; // Balance cleared as it's being refunded/applied
      }
      await manager.getRepository(Lease).save(lease);

      // 1. Create Finance Expense for Refund
      if (depositRefund && depositRefund > 0) {
        await this.financeService.createExpense({
          amount: depositRefund,
          date: new Date().toISOString().split('T')[0],
          category: 'Refund',
          description: `Security Deposit & Advance Rent Refund for Lease ${lease.lease_number}`,
          building_id: lease.building.id,
        });
      }

      // Automated Invoicing for Penalty
      if (penaltyAmount > 0) {
        await this.financeService.createInvoice({
          lease_id: lease.id,
          tenant_id: lease.tenant.id,
          unit_id: lease.unit.id,
          due_date: terminationDate,
          items: [
            {
              type: InvoiceItemType.PENALTY,
              amount: penaltyAmount,
              description: `Early termination penalty for Lease ${lease.lease_number} (Organization Policy)`,
            },
          ],
        });
      }

      const unit = await manager
        .getRepository(Unit)
        .findOne({ where: { id: lease.unit.id } });
      if (!unit) throw new NotFoundException('Unit not found');
      unit.status = UnitStatus.VACANT;
      await manager.getRepository(Unit).save(unit);

      const currentOccupancy = await manager
        .getRepository(UnitOccupancyHistory)
        .findOne({
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
        await manager
          .getRepository(UnitOccupancyHistory)
          .save(currentOccupancy);
      }
    });

    return this.leaseRepository.findOne({
      where: { id },
      relations: ['tenant', 'unit', 'building'],
    }) as Promise<Lease>;
  }

  async renew(id: string, dto: RenewLeaseDto): Promise<Lease> {
    const cleanId = this.normalizeId(id);
    const currentLease = await this.leaseRepository.findOne({
      where: { id: cleanId },
      relations: ['tenant', 'unit', 'building'],
    });
    if (!currentLease) throw new NotFoundException('Lease not found');

    if (
      ![LeaseStatus.ACTIVE, LeaseStatus.EXPIRED].includes(currentLease.status)
    ) {
      throw new BadRequestException(
        'Only active or expired lease can be renewed',
      );
    }

    if (dto.start_date > dto.end_date) {
      throw new BadRequestException('start_date must be <= end_date');
    }

    await this.ensureNoOverlap(
      currentLease.unit.id,
      dto.start_date,
      dto.end_date,
      currentLease.id,
    );

    let newRent = dto.rent_amount;
    let escalationApplied = 0;

    if (newRent === undefined) {
      const settings = await this.orgSettingsRepository.find();
      const escalationPct = settings[0]?.rent_escalation_pct ?? 0;
      escalationApplied = Number(escalationPct);
      newRent = Number(currentLease.rent_amount) * (1 + escalationApplied / 100);
    }

    const renewedLease = this.leaseRepository.create({
      lease_number: this.generateLeaseNumber(),
      tenant: currentLease.tenant,
      unit: currentLease.unit,
      building: currentLease.building,
      start_date: dto.start_date,
      end_date: dto.end_date,
      rent_amount: newRent,
      escalation_pct: escalationApplied > 0 ? escalationApplied : undefined,
      deposit_amount: currentLease.deposit_amount,
      deposit_status: DepositStatus.HELD,
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
    const lease = await this.leaseRepository.findOne({
      where: { id: cleanId },
    });
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

  async getExpiringSummary(): Promise<any> {
    const today = new Date();

    const leases = await this.leaseRepository.find({
      where: { status: LeaseStatus.ACTIVE },
    });

    let under30 = 0;
    let under60 = 0;
    let under90 = 0;

    leases.forEach((l) => {
      const end = new Date(`${l.end_date}T00:00:00`);
      const diffDays = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) under30++;
      else if (diffDays > 30 && diffDays <= 60) under60++;
      else if (diffDays > 60 && diffDays <= 90) under90++;
    });

    return { under30, under60, under90 };
  }

  async getPaymentSchedule(leaseId: string): Promise<LeasePayment[]> {
    const cleanId = this.normalizeId(leaseId);
    return this.leasePaymentRepository.find({
      where: { lease: { id: cleanId } },
      order: { due_date: 'ASC' },
    });
  }

  async runMidnightAutomation(): Promise<{
    reminders: number;
    expired: number;
    lateFeesApplied: number;
  }> {
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
      const diffDays = Math.floor(
        (endDate.getTime() - new Date(`${todayDate}T00:00:00`).getTime()) /
        (1000 * 60 * 60 * 24),
      );

      if ([30, 20, 7].includes(diffDays)) {
        reminders += 1;
      }

      if (lease.end_date < todayDate) {
        lease.status = LeaseStatus.EXPIRED;
        await this.leaseRepository.save(lease);

        const unit = await this.unitRepository.findOne({
          where: { id: lease.unit.id },
        });
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

    const settings = await this.orgSettingsRepository.find();
    const lateFeePct = settings[0]?.late_fee_percentage ?? 2.0;

    const pendingPayments = await this.leasePaymentRepository.find({
      where: { status: LeasePaymentStatus.PENDING },
    });

    let lateFeesApplied = 0;

    for (const payment of pendingPayments) {
      if (payment.due_date < todayDate) {
        const dueDateObj = new Date(`${payment.due_date}T00:00:00`);
        const daysOverdue = Math.floor(
          (today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysOverdue > 0) {
          payment.days_overdue = daysOverdue;
          payment.late_fee = Number(payment.amount) * (Number(lateFeePct) / 100) * daysOverdue;
          payment.status = LeasePaymentStatus.OVERDUE;
          await this.leasePaymentRepository.save(payment);
          lateFeesApplied += 1;
        }
      }
    }

    return { reminders, expired, lateFeesApplied };
  }

  async update(id: string, dto: Partial<{
    rent_amount: number;
    start_date: string;
    end_date: string;
    service_charge: number;
    billing_cycle: string;
    deposit_amount: number;
  }>): Promise<Lease> {
    const cleanId = this.normalizeId(id);
    const lease = await this.leaseRepository.findOne({
      where: { id: cleanId },
      relations: ['tenant', 'unit', 'building'],
    });
    if (!lease) throw new NotFoundException('Lease not found');

    if (lease.status !== LeaseStatus.DRAFT) {
      throw new BadRequestException('Only draft leases can be edited');
    }

    if (dto.start_date !== undefined) lease.start_date = dto.start_date;
    if (dto.end_date !== undefined) lease.end_date = dto.end_date;

    if (lease.start_date > lease.end_date) {
      throw new BadRequestException('start_date must be <= end_date');
    }

    if (dto.start_date || dto.end_date) {
      await this.ensureNoOverlap(lease.unit.id, lease.start_date, lease.end_date, lease.id);
    }

    if (dto.rent_amount !== undefined) lease.rent_amount = dto.rent_amount;
    if (dto.service_charge !== undefined) lease.service_charge = dto.service_charge;
    if (dto.billing_cycle !== undefined) lease.billing_cycle = dto.billing_cycle as any;
    if (dto.deposit_amount !== undefined) lease.deposit_amount = dto.deposit_amount;

    await this.leaseRepository.save(lease);

    return this.leaseRepository.findOne({
      where: { id: lease.id },
      relations: ['tenant', 'unit', 'building'],
    }) as Promise<Lease>;
  }

  async remove(id: string): Promise<void> {
    const cleanId = this.normalizeId(id);
    const lease = await this.leaseRepository.findOne({
      where: { id: cleanId },
    });
    if (!lease) throw new NotFoundException('Lease not found');

    // Allow removing drafts and terminated leases. Active or renewed leases
    // should not be deletable because they affect occupancy/history.
    if (![LeaseStatus.DRAFT, LeaseStatus.TERMINATED].includes(lease.status)) {
      throw new BadRequestException('Only draft or terminated leases can be deleted');
    }

    await this.leaseRepository.remove(lease);
  }
}
