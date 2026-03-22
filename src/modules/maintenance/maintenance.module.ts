import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceRequest } from './entities/maintenance-request.entity';
import {
  WorkOrder,
  Contractor,
} from './entities/contractor-and-workorder.entity';
import { MaintenanceFeedback } from './entities/maintenance-feedback.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { UserBuilding } from '../users/entities/user-building.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaintenanceRequest,
      WorkOrder,
      Contractor,
      MaintenanceFeedback,
      UserBuilding,
      UserRole,
      Tenant,
    ]),
    NotificationsModule,
  ],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
