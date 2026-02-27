import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Equal } from 'typeorm';
import { Lease, LeaseStatus } from '../leases/entities/lease.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Invoice, InvoiceStatus } from '../finance/entities/invoice.entity';
import { UtilityMeter } from '../utility/entities/utility-meter.entity';
import { MeterReading } from '../utility/entities/meter-reading.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class AutomationCronService {
  private readonly logger = new Logger(AutomationCronService.name);

  constructor(
    private readonly notificationService: NotificationsService,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(UtilityMeter)
    private readonly utilityMeterRepo: Repository<UtilityMeter>,
    @InjectRepository(MeterReading)
    private readonly meterReadingRepo: Repository<MeterReading>,
  ) {}

  // Lease Expiry Alerts
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async leaseExpiryScanner() {
    this.logger.log('Running Lease Expiry Scanner');
    const today = new Date();
    const daysOffsets = [30, 14, 7];
    for (const offset of daysOffsets) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + offset);
      const targetDateStr = targetDate.toISOString().split('T')[0];
      const leases = await this.leaseRepo.find({
        where: {
          end_date: Equal(targetDateStr),
          status: LeaseStatus.ACTIVE,
        },
        relations: ['tenant', 'unit', 'building'],
      });
      for (const lease of leases) {
        // Notify Tenant
        await this.notificationService.notify(
          lease.tenant.id,
          'Lease Expiry Reminder',
          `Your lease for unit ${lease.unit.id} is expiring in ${offset} days. Please contact management for renewal.`,
          NotificationType.LEASE,
          { leaseId: lease.id, unitId: lease.unit.id, buildingId: lease.building.id, daysToExpiry: offset }
        );
        // Optionally, notify Manager/Admin (if you have logic to fetch admin for building)
        // Example: const managerId = await this.getBuildingManagerId(lease.building.id);
        // if (managerId) { ...notify(managerId)... }
      }
    }
  }

  // Payment Deadline & Overdue Alerts
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async paymentDeadlineScanner() {
    this.logger.log('Running Payment Deadline Scanner');
    const today = new Date();
    // 1. Rent Due Soon (5 days away)
    const dueSoonDate = new Date(today);
    dueSoonDate.setDate(today.getDate() + 5);
    const dueSoonStr = dueSoonDate.toISOString().split('T')[0];
    const dueSoonInvoices = await this.invoiceRepo.find({
      where: {
        due_date: Equal(dueSoonStr),
        status: InvoiceStatus.PENDING,
      },
      relations: ['tenant', 'lease'],
    });
    for (const invoice of dueSoonInvoices) {
      await this.notificationService.notify(
        invoice.tenant.id,
        'Upcoming Rent Due',
        `Your rent invoice is due in 5 days. Please ensure timely payment.`,
        NotificationType.FINANCE,
        { invoiceId: invoice.id, leaseId: invoice.lease.id, dueDate: invoice.due_date }
      );
    }
    // 2. Overdue Rent (due_date < today)
    const todayStr = today.toISOString().split('T')[0];
    const overdueInvoices = await this.invoiceRepo.find({
      where: {
        due_date: LessThanOrEqual(todayStr),
        status: InvoiceStatus.PENDING,
      },
      relations: ['tenant', 'lease'],
    });
    for (const invoice of overdueInvoices) {
      // Optionally, update status to OVERDUE here if needed
      invoice.status = InvoiceStatus.OVERDUE;
      await this.invoiceRepo.save(invoice);
      await this.notificationService.notify(
        invoice.tenant.id,
        'Late Payment Warning',
        `Your rent invoice is overdue. Please pay immediately to avoid penalties.`,
        NotificationType.FINANCE,
        { invoiceId: invoice.id, leaseId: invoice.lease.id, dueDate: invoice.due_date }
      );
    }
  }

  // Monthly Utility Sync (25th of each month)
  @Cron('0 1 25 * *')
  async monthlyUtilitySync() {
    this.logger.log('Running Monthly Utility Sync');
    // Find all unbilled meter readings
    const unbilledReadings = await this.meterReadingRepo.find({
      where: { is_billed: false },
      relations: ['meter'],
    });
    for (const reading of unbilledReadings) {
      // Find tenant/unit for the meter
      // This assumes you have a way to link meter to tenant/unit
      // Example: reading.meter.unit_id or similar
      // You may need to adjust this logic based on your schema
      await this.notificationService.notify(
        /* userId */ '',
        'Utility Bill Pending',
        `A new utility reading has been recorded and will be included in your next bill.`,
        NotificationType.FINANCE,
        { meterId: reading.meter_id, readingId: reading.id, readingDate: reading.reading_date }
      );
    }
  }

  // Manual triggers for admin override
  async runJobByName(jobName: string) {
    switch (jobName) {
      case 'lease-expiry':
        await this.leaseExpiryScanner();
        break;
      case 'payment-deadline':
        await this.paymentDeadlineScanner();
        break;
      case 'utility-sync':
        await this.monthlyUtilitySync();
        break;
      default:
        throw new Error('Unknown job name');
    }
    return { status: 'Job executed', job: jobName };
  }
}
