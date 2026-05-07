import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportSchedule, ReportFrequency } from './entities/report-schedule.entity';
import { ReportsService } from './reports.service';
import { MailService } from '../notifications/mail.service';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepo: Repository<ReportSchedule>,
    private readonly reportsService: ReportsService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyReports() {
    this.logger.log('Processing daily scheduled reports...');
    await this.processSchedules(ReportFrequency.DAILY);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklyReports() {
    this.logger.log('Processing weekly scheduled reports...');
    await this.processSchedules(ReportFrequency.WEEKLY);
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyReports() {
    this.logger.log('Processing monthly scheduled reports...');
    await this.processSchedules(ReportFrequency.MONTHLY);
  }

  private async processSchedules(frequency: ReportFrequency) {
    const schedules = await this.scheduleRepo.find({
      where: { frequency, is_active: true },
      relations: ['user'],
    });

    for (const schedule of schedules) {
      try {
        this.logger.log(`Generating ${schedule.report_type} report for ${schedule.recipient_email}`);
        
        // Generate PDF
        const pdfBuffer = await this.reportsService.generatePDF(
          schedule.report_type,
          schedule.filters || {},
          schedule.user,
        );

        // Send Email
        await this.mailService.sendMail({
          to: schedule.recipient_email,
          subject: `Scheduled ${schedule.report_type.toUpperCase()} Report`,
          text: `Please find attached your scheduled ${schedule.report_type} report.`,
          attachments: [
            {
              filename: `${schedule.report_type}_report_${new Date().toISOString().split('T')[0]}.pdf`,
              content: pdfBuffer,
            },
          ],
        });

        // Update last sent
        schedule.last_sent_at = new Date();
        await this.scheduleRepo.save(schedule);
        
        this.logger.log(`Successfully sent report to ${schedule.recipient_email}`);
      } catch (error) {
        this.logger.error(`Failed to send scheduled report to ${schedule.recipient_email}: ${error.message}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshDataViews() {
    this.logger.log('Refreshing Materialized Views...');
    await this.reportsService.refreshMaterializedViews();
  }
}
