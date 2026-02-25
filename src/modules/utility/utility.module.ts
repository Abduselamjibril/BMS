import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilityService } from './utility.service';
import { UtilityController } from './utility.controller';
import { UtilityMeter } from './entities/utility-meter.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { Unit } from '../units/entities/unit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UtilityMeter, MeterReading, Unit])],
  providers: [UtilityService],
  controllers: [UtilityController],
  exports: [UtilityService],
})
export class UtilityModule {}
