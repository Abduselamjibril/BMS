import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UtilityMeter } from './entities/utility-meter.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { CreateMeterDto } from './dto/create-meter.dto';
import { CreateReadingDto } from './dto/create-reading.dto';
import { Unit } from '../units/entities/unit.entity';

@Injectable()
export class UtilityService {

    /**
     * Returns units/meters with abnormal consumption (e.g., >2x previous average)
     */
    async getUtilityLeaks() {
      // Find all meters
      const meters = await this.meterRepo.find();
      const leaks: Array<{
        meter_id: string;
        unit_id: string;
        latest_reading: number;
        previous_avg: number;
        spike_ratio: number;
      }> = [];
      for (const meter of meters) {
        // Get last 4 readings (sorted by date desc)
        const readings = await this.readingRepo.find({
          where: { meter_id: meter.id },
          order: { reading_date: 'DESC' },
          take: 4,
        });
        if (readings.length < 2) continue;
        // Calculate average of previous readings (excluding latest)
        const prev = readings.slice(1);
        const prevAvg = prev.reduce((sum, r) => sum + Number(r.reading_value), 0) / prev.length;
        const latest = readings[0];
        if (prevAvg > 0 && Number(latest.reading_value) > 2 * prevAvg) {
          // Abnormal spike detected
          leaks.push({
            meter_id: meter.id,
            unit_id: meter.unit_id,
            latest_reading: Number(latest.reading_value),
            previous_avg: prevAvg,
            spike_ratio: Number(latest.reading_value) / prevAvg,
          });
        }
      }
      return leaks;
    }
  constructor(
    @InjectRepository(UtilityMeter)
    private readonly meterRepo: Repository<UtilityMeter>,
    @InjectRepository(MeterReading)
    private readonly readingRepo: Repository<MeterReading>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(require('../leases/entities/lease.entity').Lease)
    private readonly leaseRepo: Repository<any>,
    private readonly notificationsService: NotificationsService,
  ) {}

  createMeter(dto: CreateMeterDto) {
    // validate unit_id exists
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!dto.unit_id || !uuidRegex.test(dto.unit_id)) {
      throw new BadRequestException('Invalid unit_id format');
    }
    return this.unitRepo.findOne({ where: { id: dto.unit_id } }).then((unit) => {
      if (!unit) throw new NotFoundException('Unit not found');
      const m = this.meterRepo.create(dto as any);
      return this.meterRepo.save(m);
    });
  }

  findMeters(unitId?: string) {
    const where = unitId ? { where: { unit_id: unitId } } : {};
    // @ts-ignore
    return this.meterRepo.find(where);
  }

  async findMeter(id: string) {
    const m = await this.meterRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Meter not found');
    return m;
  }

  async createReading(dto: CreateReadingDto) {
    const meter = await this.meterRepo.findOne({ where: { id: dto.meter_id } });
    if (!meter) throw new NotFoundException('Meter not found');
    const readingDate = dto.reading_date ? new Date(dto.reading_date) : new Date();
    const r: MeterReading = this.readingRepo.create({
      meter_id: dto.meter_id,
      reading_value: dto.reading_value,
      reading_date: readingDate,
      photo_url: dto.photo_url,
    });
    const savedReading: MeterReading = await this.readingRepo.save(r);

    // Find tenant for the unit via active lease
    const activeLease = await this.getActiveLeaseForUnit(meter.unit_id);
    if (activeLease && activeLease.tenant) {
      await this.notificationsService.notify(
        activeLease.tenant.id,
        'New Utility Reading',
        `Your ${meter.type} meter reading of ${dto.reading_value} was recorded on ${readingDate.toLocaleDateString()}.`,
        NotificationType.UTILITY,
        { meterId: meter.id, readingId: savedReading.id, value: dto.reading_value, photo: dto.photo_url }
      );
    }
    return savedReading;
  }

  // Helper to get active lease for unit
  private async getActiveLeaseForUnit(unitId: string) {
    return this.leaseRepo.findOne({
      where: { unit: { id: unitId }, status: 'active' },
      relations: ['tenant'],
    });
  }

  findReadings(meterId?: string) {
    const where = meterId ? { where: { meter_id: meterId } } : {};
    // @ts-ignore
    return this.readingRepo.find(where);
  }

  async markAsBilled(readingId: string) {
    const r = await this.readingRepo.findOne({ where: { id: readingId } });
    if (!r) throw new NotFoundException('Reading not found');
    r.is_billed = true;
    return this.readingRepo.save(r);
  }
}
