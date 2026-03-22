import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { LeasesService } from './leases.service';

@Injectable()
export class LeasesScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeasesScheduler.name);
  private timeoutRef?: NodeJS.Timeout;
  private intervalRef?: NodeJS.Timeout;

  constructor(private readonly leasesService: LeasesService) {}

  onModuleInit() {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const delay = nextMidnight.getTime() - now.getTime();

    this.timeoutRef = setTimeout(async () => {
      await this.handleMidnightLeaseAutomation();
      this.intervalRef = setInterval(
        () => void this.handleMidnightLeaseAutomation(),
        24 * 60 * 60 * 1000,
      );
    }, delay);
  }

  onModuleDestroy() {
    if (this.timeoutRef) clearTimeout(this.timeoutRef);
    if (this.intervalRef) clearInterval(this.intervalRef);
  }

  async handleMidnightLeaseAutomation() {
    try {
      const result = await this.leasesService.runMidnightAutomation();
      this.logger.log(
        `Lease midnight automation completed: reminders=${result.reminders}, expired=${result.expired}`,
      );
    } catch (error) {
      this.logger.error(
        'Lease midnight automation failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
