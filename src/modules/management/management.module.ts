import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagementCompany } from './entities/management-company.entity';
import { ManagementAssignment } from './entities/management-assignment.entity';
import { ManagementPermission } from './entities/management-permission.entity';

import { ManagementService } from './management.service';
import { ManagementController } from './management.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ManagementCompany,
      ManagementAssignment,
      ManagementPermission,
    ]),
  ],
  providers: [ManagementService],
  controllers: [ManagementController],
  exports: [TypeOrmModule, ManagementService],
})
export class ManagementModule {}
