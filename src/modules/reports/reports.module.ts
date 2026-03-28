import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Unit } from '../units/entities/unit.entity';
import { Lease } from '../leases/entities/lease.entity';
import { LeasePayment } from '../leases/entities/lease-payment.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Invoice } from '../finance/entities/invoice.entity';
import { Building } from '../buildings/entities/building.entity';
import { Site } from '../sites/entities/site.entity';
import { MeterReading } from '../utility/entities/meter-reading.entity';
import { MaintenanceModule } from '../maintenance/maintenance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Unit, Lease, LeasePayment, UserRole, Invoice, Building, Site, MeterReading]),
    MaintenanceModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
