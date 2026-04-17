import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Processor('monthly-invoice')
@Injectable()
export class MonthlyInvoiceProcessor {
  constructor(private readonly financeService: FinanceService) {}

  @Process('generate-invoices')
  async handleMonthlyInvoice(
    job: Job<{ site_id?: string; building_id?: string }>,
  ) {
    console.log(
      `Processing invoice generation for: ${JSON.stringify(job.data)}`,
    );
    const leases = await this.financeService.getActiveLeases(
      job.data.site_id,
      job.data.building_id,
    );

    for (const lease of leases) {
      try {
        await this.financeService.createInvoice({
          lease_id: lease.id,
          tenant_id: lease.tenant?.id || (lease as any).tenant_id,
          unit_id: lease.unit?.id || (lease as any).unit_id,
          due_date: new Date().toISOString().split('T')[0],
          status: 'draft',
          items: [
            {
              type: 'RENT',
              amount: Number(lease.rent_amount),
              description: 'Monthly Rent',
            },
          ],
        } as any);
      } catch (e) {
        console.error(
          `Failed to generate invoice for lease ${lease.id}:`,
          e.message,
        );
      }
    }

    return { generated: leases.length };
  }
}
