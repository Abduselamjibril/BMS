import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import { AutomationJob } from './entities/automation-job.entity';
import { JobLog, JobStatus } from './entities/job-log.entity';

@Injectable()
export class AutomationCronService implements OnModuleInit {
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
    @InjectRepository(AutomationJob)
    private readonly jobRepo: Repository<AutomationJob>,
    @InjectRepository(JobLog)
    private readonly logRepo: Repository<JobLog>,
  ) {}

  async onModuleInit() {
    await this.seedJobs();
  }

  private async seedJobs() {
    const defaultJobs = [
      {
        name: 'lease-expiry',
        label: 'Lease Expiry Scanner',
        description: 'Notifies tenants whose leases are expiring in 30, 14, or 7 days.',
        schedule: 'Daily @ 1:00 AM',
      },
      {
        name: 'payment-deadline',
        label: 'Payment Deadline Scanner',
        description: 'Sends rent due reminders and marks overdue invoices.',
        schedule: 'Daily @ 1:00 AM',
      },
      {
        name: 'utility-sync',
        label: 'Monthly Utility Sync',
        description: 'Notifies tenants of recorded unbilled utility readings.',
        schedule: 'Monthly @ Day 25',
      },
    ];

    for (const job of defaultJobs) {
      const exists = await this.jobRepo.findOne({ where: { name: job.name } });
      if (!exists) {
        await this.jobRepo.save(this.jobRepo.create(job));
        this.logger.log(`Seeded automation job: ${job.name}`);
      }
    }
  }

  async isJobEnabled(jobName: string): Promise<boolean> {
    const job = await this.jobRepo.findOne({ where: { name: jobName } });
    return job?.is_enabled ?? true;
  }

  async enableJob(jobName: string) {
    await this.jobRepo.update({ name: jobName }, { is_enabled: true });
    this.logger.log(`Job "${jobName}" enabled`);
  }

  async disableJob(jobName: string) {
    await this.jobRepo.update({ name: jobName }, { is_enabled: false });
    this.logger.log(`Job "${jobName}" disabled`);
  }

  async getJobStatuses() {
    return this.jobRepo.find({ order: { name: 'ASC' } });
  }

  async getExecutionLogs(limit = 50) {
    return this.logRepo.find({
      order: { executed_at: 'DESC' },
      take: limit,
    });
  }

  private async logExecution(jobName: string, logic: () => Promise<any>) {
    const isEnabled = await this.isJobEnabled(jobName);
    if (!isEnabled) {
      this.logger.log(`Job "${jobName}" is disabled — skipping`);
      return;
    }

    this.logger.log(`Starting Job: ${jobName}`);
    const log = this.logRepo.create({ job_name: jobName });

    try {
      const result = await logic();
      log.status = JobStatus.SUCCESS;
      log.result = result;
      await this.jobRepo.update({ name: jobName }, { last_run_at: new Date() });
    } catch (error) {
      log.status = JobStatus.FAILED;
      log.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Job "${jobName}" failed: ${log.error}`);
    } finally {
      await this.logRepo.save(log);
    }
  }

  // --- Scanners ---

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async leaseExpiryScanner() {
    await this.logExecution('lease-expiry', async () => {
      const today = new Date();
      const daysOffsets = [30, 14, 7];
      let notifiedCount = 0;

      for (const offset of daysOffsets) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + offset);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        const leases = await this.leaseRepo.find({
          where: {
            end_date: Equal(targetDateStr),
            status: LeaseStatus.ACTIVE,
          },
          relations: ['tenant', 'tenant.user', 'unit', 'building'],
        });

        for (const lease of leases) {
          await this.notificationService.notify(
            lease.tenant.user.id,
            'Lease Expiry Reminder',
            `Your lease for unit ${lease.unit.id} is expiring in ${offset} days. Please contact management for renewal.`,
            NotificationType.LEASE,
            { leaseId: lease.id, unitId: lease.unit.id, daysToExpiry: offset },
          );
          notifiedCount++;
        }
      }
      return { notified: notifiedCount, offsets: daysOffsets };
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async paymentDeadlineScanner() {
    await this.logExecution('payment-deadline', async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      let remindersSent = 0;
      let overdueMarked = 0;

      // 1. Due Soon (5 days)
      const dueSoonDate = new Date(today);
      dueSoonDate.setDate(today.getDate() + 5);
      const dueSoonStr = dueSoonDate.toISOString().split('T')[0];
      
      const dueSoonInvoices = await this.invoiceRepo.find({
        where: { due_date: Equal(dueSoonStr), status: InvoiceStatus.PENDING },
        relations: ['tenant', 'tenant.user', 'lease'],
      });

      for (const invoice of dueSoonInvoices) {
        await this.notificationService.notify(
          invoice.tenant.user.id,
          'Upcoming Rent Due',
          `Your rent invoice is due in 5 days.`,
          NotificationType.FINANCE,
          { invoiceId: invoice.id, dueDate: invoice.due_date },
        );
        remindersSent++;
      }

      // 2. Overdue
      const overdueInvoices = await this.invoiceRepo.find({
        where: { due_date: LessThanOrEqual(todayStr), status: InvoiceStatus.PENDING },
        relations: ['tenant', 'tenant.user', 'lease'],
      });

      for (const invoice of overdueInvoices) {
        invoice.status = InvoiceStatus.OVERDUE;
        await this.invoiceRepo.save(invoice);
        await this.notificationService.notify(
          invoice.tenant.user.id,
          'Late Payment Warning',
          `Your rent invoice is overdue.`,
          NotificationType.FINANCE,
          { invoiceId: invoice.id, dueDate: invoice.due_date },
        );
        overdueMarked++;
      }

      return { remindersSent, overdueMarked };
    });
  }

  @Cron('0 1 25 * *')
  async monthlyUtilitySync() {
    await this.logExecution('utility-sync', async () => {
      const unbilledReadings = await this.meterReadingRepo.find({
        where: { is_billed: false },
        relations: ['meter'],
      });

      let notified = 0;
      let skipped = 0;

      for (const reading of unbilledReadings) {
        const unitId = reading.meter?.unit_id;
        if (!unitId) { skipped++; continue; }

        const lease = await this.leaseRepo.findOne({
          where: { unit: { id: unitId }, status: LeaseStatus.ACTIVE },
          relations: ['tenant', 'tenant.user'],
        });

        if (!lease?.tenant?.id) { skipped++; continue; }

        await this.notificationService.notify(
          lease.tenant.user.id,
          'Utility Bill Pending',
          `A new utility reading has been recorded for your unit.`,
          NotificationType.FINANCE,
          { meterId: reading.meter_id, readingDate: reading.reading_date },
        );
        notified++;
      }
      return { notified, skipped, totalReadings: unbilledReadings.length };
    });
  }

  // --- Housekeeping ---

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async logCleanup() {
    // Delete logs older than 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const deleteResult = await this.logRepo.delete({
      executed_at: LessThanOrEqual(threeMonthsAgo),
    });

    this.logger.log(`Log cleanup completed: deleted ${deleteResult.affected} entries older than ${threeMonthsAgo.toISOString()}`);
  }

  async runJobByName(jobName: string) {
    switch (jobName) {
      case 'lease-expiry': await this.leaseExpiryScanner(); break;
      case 'payment-deadline': await this.paymentDeadlineScanner(); break;
      case 'utility-sync': await this.monthlyUtilitySync(); break;
      default: throw new Error('Unknown job name');
    }
    return { status: 'Job execution triggered', job: jobName };
  }
}
