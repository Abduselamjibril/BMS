import { Injectable } from '@nestjs/common';

@Injectable()
export class LeasePdfService {
  async generateLeasePdf(data: {
    lease_number: string;
    tenant_name: string;
    unit_number: string;
    building_name: string;
    start_date: string;
    end_date: string;
    rent_amount: number;
    service_charge: number;
  }): Promise<Buffer> {
    const template =
      'This lease confirms {{tenant_name}} occupies unit {{unit_number}} in {{building_name}} from {{start_date}} to {{end_date}} under lease {{lease_number}}.';

    const paragraph = template
      .replace('{{tenant_name}}', data.tenant_name)
      .replace('{{unit_number}}', data.unit_number)
      .replace('{{building_name}}', data.building_name)
      .replace('{{start_date}}', data.start_date)
      .replace('{{end_date}}', data.end_date)
      .replace('{{lease_number}}', data.lease_number);

    const content = [
      'Lease Agreement',
      `Lease Number: ${data.lease_number}`,
      `Tenant Name: ${data.tenant_name}`,
      `Building: ${data.building_name}`,
      `Unit: ${data.unit_number}`,
      `Start Date: ${data.start_date}`,
      `End Date: ${data.end_date}`,
      `Rent Amount: ${data.rent_amount}`,
      `Service Charge: ${data.service_charge}`,
      '',
      paragraph,
    ].join('\n');

    return Buffer.from(content, 'utf-8');
  }
}
