import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Processor('overdue-penalty')
@Injectable()
export class OverduePenaltyProcessor {
  constructor(private readonly financeService: FinanceService) {}

  @Process()
  async handleOverduePenalty(job: Job) {
    // job.data: { date }
    // Find invoices due before date and not PAID, set status to OVERDUE, add penalty item
    // Example:
    // const overdueInvoices = await this.financeService.getOverdueInvoices(job.data.date);
    // for (const invoice of overdueInvoices) {
    //   await this.financeService.applyPenalty(invoice);
    // }
    return { status: 'completed' };
  }
}
