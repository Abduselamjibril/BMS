import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

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
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fontSize(20).text('Lease Agreement', { align: 'center' });
      doc.moveDown();

      // Details
      doc.fontSize(12).text(`Lease Number: ${data.lease_number}`);
      doc.text(`Tenant Name: ${data.tenant_name}`);
      doc.text(`Building: ${data.building_name}`);
      doc.text(`Unit: ${data.unit_number}`);
      doc.text(`Start Date: ${data.start_date}`);
      doc.text(`End Date: ${data.end_date}`);
      doc.text(`Rent Amount: ${data.rent_amount} ETB`);
      doc.text(`Service Charge: ${data.service_charge} ETB`);

      doc.moveDown();
      doc.fontSize(14).text('Agreement Summary');
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .text(
          `This lease confirms that ${data.tenant_name} occupies unit ${data.unit_number} in ${data.building_name} from ${data.start_date} to ${data.end_date} under lease ${data.lease_number}.`,
          { align: 'justify' },
        );

      doc.moveDown(2);
      doc.text('Signed:', { continued: true });
      doc.text(' __________________________', { oblique: true });
      doc.text('Date:', { continued: true });
      doc.text(' __________________________', { oblique: true });

      doc.end();
    });
  }
}
