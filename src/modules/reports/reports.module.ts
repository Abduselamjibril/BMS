import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Unit } from '../units/entities/unit.entity';
import { Lease } from '../leases/entities/lease.entity';
import { Payment } from '../finance/entities/payment.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Invoice } from '../finance/entities/invoice.entity';
import { Building } from '../buildings/entities/building.entity';
import { Site } from '../sites/entities/site.entity';
import { MeterReading } from '../utility/entities/meter-reading.entity';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Visitor } from '../visitors/entities/visitor.entity';
import { InvoiceItem } from '../finance/entities/invoice-item.entity';
import { BuildingAdminAssignment } from '../buildings/entities/building-admin-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Unit, Lease, Payment, UserRole, Invoice, Building, Site, MeterReading, Tenant, Visitor, InvoiceItem, BuildingAdminAssignment]),
    MaintenanceModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
