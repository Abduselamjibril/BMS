import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitorsService } from './visitors.service';
import { VisitorsController } from './visitors.controller';
import { Visitor } from './entities/visitor.entity';
import { Site } from '../sites/entities/site.entity';
import { Unit } from '../units/entities/unit.entity';
import { Lease } from '../leases/entities/lease.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { BuildingAdminAssignment } from '../buildings/entities/building-admin-assignment.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Visitor, Site, Unit, Lease, UserRole, BuildingAdminAssignment, Tenant]),
    NotificationsModule,
  ],
  providers: [VisitorsService],
  controllers: [VisitorsController],
  exports: [VisitorsService],
})
export class VisitorsModule {}
