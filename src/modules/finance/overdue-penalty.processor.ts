import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Processor('overdue-penalty')
@Injectable()
export class OverduePenaltyProcessor {
  constructor(private readonly financeService: FinanceService) {}

  @Process('apply-penalties')
  async handleOverduePenalty(job: Job<{ date: string }>) {
    console.log(`Processing overdue penalties for date: ${job.data.date}`);
    const overdueInvoices = await this.financeService.getOverdueInvoices(
      job.data.date,
    );

    for (const invoice of overdueInvoices) {
      try {
        await this.financeService.applyPenalty(invoice);
      } catch (e) {
        console.error(
          `Failed to apply penalty for invoice ${invoice.id}:`,
          e.message,
        );
      }
    }

    return { processed: overdueInvoices.length };
  }
}
