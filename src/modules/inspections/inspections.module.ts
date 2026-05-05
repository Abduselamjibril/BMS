import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { Inspection, InspectionItem } from './entities/inspections.entity';
import { Lease } from '../leases/entities/lease.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Owner } from '../owners/entities/owner.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Building } from '../buildings/entities/building.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection, InspectionItem, Lease, Tenant, Owner, UserRole, Building])],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
