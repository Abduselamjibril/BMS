import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { Lease } from './entities/lease.entity';
import { UnitOccupancyHistory } from './entities/unit-occupancy-history.entity';
import { LeasePayment } from './entities/lease-payment.entity';
import { Unit } from '../units/entities/unit.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Building } from '../buildings/entities/building.entity';
import { TenantDocument } from '../tenants/entities/tenant-document.entity';
import { BuildingAdminAssignment } from '../buildings/entities/building-admin-assignment.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { LeasesScheduler } from './leases.scheduler';
import { LeasePdfService } from './services/lease-pdf.service';
import { OrganizationSettings } from '../settings/entities/organization-settings.entity';
import { Owner } from '../owners/entities/owner.entity';
import { FinanceModule } from '../finance/finance.module';
import { CommissionModule } from '../commission/commission.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lease,
      UnitOccupancyHistory,
      LeasePayment,
      Unit,
      Tenant,
      Building,
      TenantDocument,
      BuildingAdminAssignment,
      UserRole,
      OrganizationSettings,
      Owner,
    ]),
    forwardRef(() => FinanceModule),
    CommissionModule,
  ],
  controllers: [LeasesController],
  providers: [LeasesService, LeasesScheduler, LeasePdfService],
  exports: [LeasesService],
})
export class LeasesModule {}
