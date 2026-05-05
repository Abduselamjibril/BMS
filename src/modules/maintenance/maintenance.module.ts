import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceRequest } from './entities/maintenance-request.entity';
import {
  WorkOrder,
  Contractor,
} from './entities/contractor-and-workorder.entity';
import { MaintenanceFeedback } from './entities/maintenance-feedback.entity';
import { MaintenanceSchedule } from './entities/maintenance-schedule.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { UserBuilding } from '../users/entities/user-building.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Expense } from '../finance/entities/expense.entity';
import { Owner } from '../owners/entities/owner.entity';
import { Building } from '../buildings/entities/building.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaintenanceRequest,
      WorkOrder,
      Contractor,
      MaintenanceFeedback,
      MaintenanceSchedule,
      UserBuilding,
      UserRole,
      Tenant,
      Expense,
      Owner,
      Building,
    ]),
    NotificationsModule,
    CommissionModule,
  ],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
