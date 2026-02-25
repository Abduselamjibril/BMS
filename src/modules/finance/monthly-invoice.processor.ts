import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Processor('monthly-invoice')
@Injectable()
export class MonthlyInvoiceProcessor {
  constructor(private readonly financeService: FinanceService) {}

  @Process()
  async handleMonthlyInvoice(job: Job) {
    // job.data: { site_id, building_id }
    // Fetch all active leases for site/building, generate invoices
    // This is a stub, actual implementation will query leases and call createInvoice
    // Example:
    // const leases = await this.financeService.getActiveLeases(job.data.site_id, job.data.building_id);
    // for (const lease of leases) {
    //   await this.financeService.createInvoice({ ... });
    // }
    return { status: 'completed' };
  }
}
