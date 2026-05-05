import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilityService } from './utility.service';
import { UtilityController } from './utility.controller';
import { UtilityMeter } from './entities/utility-meter.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { Unit } from '../units/entities/unit.entity';
import { Lease } from '../leases/entities/lease.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { BuildingAdminAssignment } from '../buildings/entities/building-admin-assignment.entity';
import { Owner } from '../owners/entities/owner.entity';
import { Building } from '../buildings/entities/building.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UtilityMeter, MeterReading, Unit, Lease, UserRole, BuildingAdminAssignment, Tenant, Owner, Building]),
    NotificationsModule,
  ],
  providers: [UtilityService],
  controllers: [UtilityController],
  exports: [UtilityService],
})
export class UtilityModule {}
