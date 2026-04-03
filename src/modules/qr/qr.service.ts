import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QRCode, QRCodeStatus, QRCodeType } from './entities/qr-code.entity';
import { QRScanLog } from './entities/qr-scan-log.entity';
import { randomBytes } from 'crypto';
import { InjectRepository as InjectRepo2 } from '@nestjs/typeorm';
import { Repository as Repo2 } from 'typeorm';
import { Unit } from '../units/entities/unit.entity';
import { Building } from '../buildings/entities/building.entity';
import { MoreThan } from 'typeorm';

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(QRCode)
    private readonly qrRepo: Repository<QRCode>,
    @InjectRepository(QRScanLog)
    private readonly logRepo: Repository<QRScanLog>,
    @InjectRepository(Unit)
    private readonly unitRepo?: Repository<Unit>,
    @InjectRepository(Building)
    private readonly buildingRepo?: Repository<Building>,
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

  async createForBuilding(
    buildingId: string,
    opts?: { type?: QRCodeType; expiresAt?: Date },
  ) {
    const token = this.generateToken(12);
    const qr = this.qrRepo.create({
      building_id: buildingId,
      token,
      status: QRCodeStatus.ACTIVE,
      type: opts?.type ?? QRCodeType.PUBLIC,
      expires_at: opts?.expiresAt ?? null,
    });
    return this.qrRepo.save(qr);
  }

  async getBuildingUnitsByToken(token: string) {
    const qr = await this.qrRepo.findOne({ where: { token } });
    if (!qr || qr.status !== QRCodeStatus.ACTIVE || (qr.expires_at && qr.expires_at < new Date())) {
      throw new NotFoundException('QR token not found or inactive/expired');
    }
    if (!qr.building_id) {
      throw new NotFoundException('This QR code is not linked to a building');
    }

    qr.scan_count = (qr.scan_count || 0) + 1;
    await this.qrRepo.save(qr);

    let building: any = null;
    try {
      if (this.buildingRepo) {
        building = await this.buildingRepo.findOne({ where: { id: qr.building_id } });
      }
    } catch (e) { /* ignore */ }

    let units: any[] = [];
    try {
      if (this.unitRepo) {
        units = await this.unitRepo.find({
          where: { building_id: qr.building_id } as any,
          relations: ['unitAmenities', 'unitAmenities.amenity', 'assets'] as any,
        });
      }
    } catch (e) { /* ignore */ }

    return {
      building: building ? { id: building.id, name: building.name, address: building.address, image_url: building.image_url } : null,
      units: units.map(u => ({
        id: u.id,
        unit_number: u.unit_number,
        floor: u.floor,
        type: u.type,
        status: u.status,
        size_sqm: u.size_sqm,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        rent_price: u.rent_price,
        image_url: u.image_url,
        amenities: (u.unitAmenities || []).map((ua: any) => ({
          id: ua.amenity.id,
          name: ua.amenity.name,
        })),
        assets: (u.assets || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          category: a.category,
          image_url: a.image_url,
        })),
      })),
    };
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
            'assets',
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
            assets: (unit.assets || []).map((a: any) => ({
              id: a.id,
              name: a.name,
              category: a.category,
              image_url: a.image_url,
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

  async getScanStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await this.logRepo.find({
      where: { scanned_at: MoreThan(thirtyDaysAgo) },
      order: { scanned_at: 'ASC' },
    });

    // 1. Time Series (30 days)
    const timeSeries: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      timeSeries[key] = 0;
    }

    // 2. Device Breakdown
    const devices: Record<string, number> = {};

    // 3. Unique Scans (by IP)
    const uniqueIps = new Set<string>();

    logs.forEach((log) => {
      const day = log.scanned_at.toISOString().split('T')[0];
      if (timeSeries[day] !== undefined) timeSeries[day]++;

      const dev = (log.device_type || 'Unknown').toLowerCase();
      let type = 'Other';
      if (dev.includes('mobile') || dev.includes('android') || dev.includes('iphone')) type = 'Mobile';
      else if (dev.includes('windows') || dev.includes('macintosh') || dev.includes('linux')) type = 'Desktop';
      else if (dev.includes('tablet') || dev.includes('ipad')) type = 'Tablet';
      
      devices[type] = (devices[type] || 0) + 1;
      if (log.ip_address) uniqueIps.add(log.ip_address);
    });

    return {
      timeSeries: Object.entries(timeSeries)
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      devices: Object.entries(devices).map(([label, value]) => ({ label, value })),
      totalScans: logs.length,
      uniqueScans: uniqueIps.size,
    };
  }

  async getRecentLogs(limit = 100) {
    return this.logRepo.find({
      order: { scanned_at: 'DESC' },
      take: limit,
      relations: ['qr'],
    });
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
