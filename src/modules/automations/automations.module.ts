import { Module } from '@nestjs/common';
import { AutomationCronService } from './automation-cron.service';
import { AutomationsController } from './automations.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lease } from '../leases/entities/lease.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Invoice } from '../finance/entities/invoice.entity';
import { UtilityMeter } from '../utility/entities/utility-meter.entity';
import { MeterReading } from '../utility/entities/meter-reading.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationsModule,
      TypeOrmModule.forFeature([
        Lease,
        Tenant,
        User,
        Invoice,
        UtilityMeter,
        MeterReading,
      ]),
  ],
  providers: [AutomationCronService],
  controllers: [AutomationsController],
})
export class AutomationsModule {}
