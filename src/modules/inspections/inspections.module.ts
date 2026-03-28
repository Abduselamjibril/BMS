import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { Inspection, InspectionItem } from './entities/inspections.entity';
import { Lease } from '../leases/entities/lease.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection, InspectionItem, Lease, Tenant])],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
