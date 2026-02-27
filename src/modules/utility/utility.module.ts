import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilityService } from './utility.service';
import { UtilityController } from './utility.controller';
import { UtilityMeter } from './entities/utility-meter.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { Unit } from '../units/entities/unit.entity';
import { Lease } from '../leases/entities/lease.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UtilityMeter, MeterReading, Unit, Lease]),
    NotificationsModule,
  ],
  providers: [UtilityService],
  controllers: [UtilityController],
  exports: [UtilityService],
})
export class UtilityModule {}
