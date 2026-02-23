import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { Tenant } from './entities/tenant.entity';
import { TenantApplication } from './entities/tenant-application.entity';
import { TenantDocument } from './entities/tenant-document.entity';
import { Message } from './entities/message.entity';
import { Announcement } from './entities/announcement.entity';
import { User } from '../users/entities/user.entity';
import { Unit } from '../units/entities/unit.entity';
import { Building } from '../buildings/entities/building.entity';
import { Site } from '../sites/entities/site.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantApplication,
      TenantDocument,
      Message,
      Announcement,
      User,
      Unit,
      Building,
      Site,
      UserRole,
    ]),
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
