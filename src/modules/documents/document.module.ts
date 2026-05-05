import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, DocumentVersion } from './entities/document.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Lease } from '../leases/entities/lease.entity';
import { TenantDocument } from '../tenants/entities/tenant-document.entity';
import { Owner } from '../owners/entities/owner.entity';
import { Building } from '../buildings/entities/building.entity';
import { DocumentService } from './document.service';
import { DocumentTemplateService } from './template.service';
import { DocumentController } from './document.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentVersion, UserRole, Tenant, Lease, TenantDocument, Owner, Building]),
    NotificationsModule,
  ],
  providers: [DocumentService, DocumentTemplateService],
  exports: [DocumentService, DocumentTemplateService],
  controllers: [DocumentController],
})
export class DocumentModule {}
