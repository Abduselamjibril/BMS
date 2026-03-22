import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QRCode, QRCodeStatus, QRCodeType } from './entities/qr-code.entity';
import { QRScanLog } from './entities/qr-scan-log.entity';
import { randomBytes } from 'crypto';
import { InjectRepository as InjectRepo2 } from '@nestjs/typeorm';
import { Repository as Repo2 } from 'typeorm';
import { Unit } from '../units/entities/unit.entity';

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(QRCode)
    private readonly qrRepo: Repository<QRCode>,
    @InjectRepository(QRScanLog)
    private readonly logRepo: Repository<QRScanLog>,
    @InjectRepository(Unit)
    private readonly unitRepo?: Repository<Unit>,
  ) {}

  private generateToken(len = 12): string {
    const alphabet =
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const bytes = randomBytes(len);
    let token = '';
    for (let i = 0; i < bytes.length; i++) {
      token += alphabet[bytes[i] % alphabet.length];
    }
    return token;
  }

  async createForUnit(
    unitId: string,
    opts?: { type?: QRCodeType; expiresAt?: Date },
  ) {
    const token = this.generateToken(12);
    const qr = this.qrRepo.create({
      unit_id: unitId,
      token,
      status: QRCodeStatus.ACTIVE,
      type: opts?.type ?? QRCodeType.PUBLIC,
      expires_at: opts?.expiresAt ?? null,
    });
    return this.qrRepo.save(qr);
  }

  async generateQrPngBuffer(token: string, urlBase = 'https://app.com/q') {
    const qr = await this.qrRepo.findOne({ where: { token } });
    if (
      !qr ||
      qr.status !== QRCodeStatus.ACTIVE ||
      (qr.expires_at && qr.expires_at < new Date())
    ) {
      throw new NotFoundException('QR token not found or inactive/expired');
    }

    const url = `${urlBase}/${token}`;
    try {
      const qrcode = await import('qrcode');
      // prefer toBuffer if available
      if (typeof (qrcode as any).toBuffer === 'function') {
        return (qrcode as any).toBuffer(url);
      }
      // fallback to dataURL -> buffer
      const dataUrl = await (qrcode as any).toDataURL(url);
      const base64 = dataUrl.split(',')[1];
      return Buffer.from(base64, 'base64');
    } catch (err) {
      throw new Error(
        'QR generation requires the `qrcode` package. Install with `npm i qrcode`',
      );
    }
  }

  async recordScan(token: string, deviceType?: string, ip?: string) {
    const qr = await this.qrRepo.findOne({ where: { token } });
    if (
      !qr ||
      qr.status !== QRCodeStatus.ACTIVE ||
      (qr.expires_at && qr.expires_at < new Date())
    ) {
      throw new NotFoundException('QR token not found or inactive/expired');
    }

    qr.scan_count = (qr.scan_count || 0) + 1;
    await this.qrRepo.save(qr);

    // sanitize device and ip to avoid DB column issues
    const safeDevice = deviceType
      ? String(deviceType).slice(0, 1000)
      : undefined;
    const safeIp = ip ? String(ip).slice(0, 45) : undefined;
    const log = this.logRepo.create({
      qr_id: qr.id,
      scanned_at: new Date(),
      device_type: safeDevice,
      ip_address: safeIp,
    });
    await this.logRepo.save(log);
    // optionally include unit details if unitRepo is available
    let unitDetails: any = null;
    try {
      if (this.unitRepo) {
        const unit = await this.unitRepo.findOne({
          where: { id: qr.unit_id },
          relations: [
            'building',
            'unitAmenities',
            'unitAmenities.amenity',
          ] as any,
        });
        if (unit) {
          unitDetails = {
            id: unit.id,
            unit_number: unit.unit_number,
            type: unit.type,
            size_sqm: unit.size_sqm,
            building: unit.building
              ? { id: unit.building.id, name: unit.building.name }
              : null,
            amenities: (unit.unitAmenities || []).map((ua: any) => ({
              id: ua.amenity.id,
              name: ua.amenity.name,
            })),
          };
        }
      }
    } catch (e) {
      // ignore failures for optional enrichment
    }

    return { qr, log, unit: unitDetails };
  }

  async analytics(limit = 50) {
    const qrs = await this.qrRepo
      .createQueryBuilder('q')
      .orderBy('q.scan_count', 'DESC')
      .limit(limit)
      .getMany();

    const items = await Promise.all(
      qrs.map(async (qr) => {
        let unit: any = null;
        try {
          if (this.unitRepo) {
            unit = await this.unitRepo.findOne({
              where: { id: qr.unit_id },
              relations: ['building'] as any,
            });
          }
        } catch (e) {
          unit = null;
        }
        return {
          id: qr.id,
          token: qr.token,
          unit_id: qr.unit_id,
          scan_count: qr.scan_count,
          unit_number: unit ? unit.unit_number : null,
          building: unit && unit.building ? unit.building.name : null,
          status: qr.status,
        };
      }),
    );

    return items;
  }

  async deactivate(id: string) {
    const qr = await this.qrRepo.findOne({ where: { id } });
    if (!qr) throw new NotFoundException('QR not found');
    qr.status = QRCodeStatus.INACTIVE;
    return this.qrRepo.save(qr);
  }

  async exportPdf(options?: { ids?: string[]; urlBase?: string }) {
    const { ids, urlBase = 'https://app.com/q' } = options || {};
    const qrs =
      ids && ids.length
        ? await this.qrRepo.find({ 
            where: { id: require('typeorm').In(ids) },
            relations: ['unit'] as any
          })
        : await this.qrRepo.find({ 
            where: {}, 
            order: { created_at: 'ASC' },
            relations: ['unit'] as any
          });

    if (!qrs.length) return Buffer.from('');

    // dynamic import of qrcode and pdfkit
    const qrcode = await import('qrcode');
    let PDFDocument: any;
    try {
      PDFDocument =
        (await import('pdfkit')).default || (await import('pdfkit'));
    } catch (err) {
      throw new Error(
        'PDF generation requires `pdfkit`. Install with `npm i pdfkit`',
      );
    }

    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    // layout: 2 columns per row, each QR with caption
    const pageSize = { width: 595.28, height: 841.89 }; // A4 in points
    const margin = 40;
    const colWidth = (pageSize.width - margin * 2) / 2;
    const imgSize = 180;
    let x = margin;
    let y = margin;

    doc.addPage({ size: 'A4', margin: 0 });

    for (let i = 0; i < qrs.length; i++) {
      const qr = qrs[i];
      const url = `${urlBase}/${qr.token}`;
      const png = await (qrcode as any).toBuffer(url);

      // draw image
      doc.image(png, x + (colWidth - imgSize) / 2, y, {
        width: imgSize,
        height: imgSize,
      });
      // caption
      const unitLabel = (qr as any).unit?.unit_number || qr.unit_id?.slice(0, 8) || 'Unknown';
      doc.fontSize(10).text(`Unit: ${unitLabel}`, x + 10, y + imgSize + 8, {
        width: colWidth - 20,
      });
      doc.fontSize(9).text(`Token: ${qr.token}`, x + 10, y + imgSize + 22, {
        width: colWidth - 20,
      });

      // move to next column/row
      if (x + colWidth * 2 <= pageSize.width - margin) {
        x += colWidth;
      } else {
        // new row
        x = margin;
        y += imgSize + 60;
      }

      // new page if needed
      if (y + imgSize + 80 > pageSize.height - margin) {
        doc.addPage({ size: 'A4', margin: 0 });
        x = margin;
        y = margin;
      }
    }

    doc.end();
    return done;
  }
}
