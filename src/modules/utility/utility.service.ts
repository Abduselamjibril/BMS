import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UtilityMeter } from './entities/utility-meter.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { CreateMeterDto } from './dto/create-meter.dto';
import { CreateReadingDto } from './dto/create-reading.dto';
import { Unit } from '../units/entities/unit.entity';

@Injectable()
export class UtilityService {
  constructor(
    @InjectRepository(UtilityMeter)
    private readonly meterRepo: Repository<UtilityMeter>,
    @InjectRepository(MeterReading)
    private readonly readingRepo: Repository<MeterReading>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
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
    const r = this.readingRepo.create({
      meter_id: dto.meter_id,
      reading_value: dto.reading_value,
      reading_date: readingDate,
      photo_url: dto.photo_url,
    } as any);
    return this.readingRepo.save(r);
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
