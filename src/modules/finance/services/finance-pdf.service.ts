import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FinancePdfService {
  async generateReceiptPdf(data: {
    receipt_no: string;
    amount: number;
    payment_date: string;
    tenant_name: string;
    invoice_no: string;
    reference_no: string;
    company_name?: string;
    logo_path?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Brand / Header
      if (data.logo_path && fs.existsSync(data.logo_path)) {
        doc.image(data.logo_path, 50, 45, { width: 50 });
        doc.moveDown();
      }

      doc.fontSize(20).text(data.company_name || 'OFFICIAL RECEIPT', { align: 'center' });
      if (data.company_name) {
          doc.fontSize(10).text('OFFICIAL RECEIPT', { align: 'center' });
      }
      doc.moveDown();

      // Details
      doc.fontSize(12).text(`Receipt No: ${data.receipt_no}`, { align: 'right' });
      doc.text(`Date: ${data.payment_date}`, { align: 'right' });
      doc.moveDown();

      doc.text(`Received From: ${data.tenant_name}`);
      doc.text(`Amount: ${data.amount} ETB`);
      doc.text(`Payment For: Invoice #${data.invoice_no}`);
      doc.text(`Reference No: ${data.reference_no}`);
      doc.moveDown();

      doc.fontSize(14).text('Total Paid:', { continued: true });
      doc.text(` ${data.amount} ETB`);

      doc.moveDown(3);
      doc.fontSize(10).text('Authorized Signature: __________________________', { align: 'right' });
      doc.text('Thank you for your payment!', { align: 'center' });

      doc.end();
    });
  }

  async generateLedgerPdf(tenantName: string, ledger: any[], branding?: { company_name?: string; logo_path?: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Brand / Header
      if (branding?.logo_path && fs.existsSync(branding.logo_path)) {
        doc.image(branding.logo_path, 50, 45, { width: 50 });
        doc.moveDown();
      }

      doc.fontSize(20).text(branding?.company_name || 'TENANT STATEMENT', { align: 'center' });
      if (branding?.company_name) {
          doc.fontSize(10).text('TENANT STATEMENT', { align: 'center' });
      }
      doc.moveDown();

      doc.fontSize(12).text(`Tenant: ${tenantName}`);
      doc.text(`Generated On: ${new Date().toISOString().split('T')[0]}`);
      doc.moveDown();

      // Table Header
      const tableTop = 180;
      doc.fontSize(10).fillColor('#444444');
      doc.text('Date', 50, tableTop);
      doc.text('Description', 120, tableTop);
      doc.text('Debit', 300, tableTop);
      doc.text('Credit', 380, tableTop);
      doc.text('Balance', 460, tableTop);

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let y = tableTop + 25;
      doc.fillColor('#000000');
      
      for (const entry of ledger) {
        if (y > 700) {
           doc.addPage();
           y = 50;
        }
        doc.text(entry.date, 50, y);
        doc.text(entry.description, 120, y, { width: 170 });
        doc.text(entry.debit > 0 ? entry.debit.toFixed(2) : '-', 300, y);
        doc.text(entry.credit > 0 ? entry.credit.toFixed(2) : '-', 380, y);
        doc.text(entry.balance.toFixed(2), 460, y);
        y += 20;
      }

      doc.moveTo(50, y).lineTo(550, y).stroke();
      doc.moveDown();
      doc.fontSize(12).text(`Current Balance: ${ledger[ledger.length - 1]?.balance.toFixed(2) || '0.00'} ETB`, { align: 'right' });

      doc.end();
    });
  }
}
