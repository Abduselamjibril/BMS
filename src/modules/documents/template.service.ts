import { Injectable } from '@nestjs/common';
import { Lease } from '../leases/entities/lease.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Injectable()
export class DocumentTemplateService {
  /**
   * Replaces placeholders in a template string with actual data.
   * Format: {{tenant_name}}, {{unit_number}}, {{lease_start}}, etc.
   */
  compile(template: string, data: { lease: Lease; tenant: Tenant }): string {
    let result = template;
    
    const replacements: Record<string, string> = {
      '{{tenant_name}}': `${data.tenant.first_name} ${data.tenant.last_name}`,
      '{{tenant_id}}': data.tenant.id,
      '{{unit_number}}': data.lease.unit?.unit_number || 'N/A',
      '{{lease_start}}': new Date(data.lease.start_date).toLocaleDateString(),
      '{{lease_end}}': new Date(data.lease.end_date).toLocaleDateString(),
      '{{rent_amount}}': data.lease.rent_amount.toString(),
      '{{date}}': new Date().toLocaleDateString(),
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
  }
}
