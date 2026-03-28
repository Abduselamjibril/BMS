import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, DocumentVersion } from './entities/document.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Lease } from '../leases/entities/lease.entity';
import { DocumentService } from './document.service';
import { DocumentTemplateService } from './template.service';
import { DocumentController } from './document.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentVersion, UserRole, Tenant, Lease]),
    NotificationsModule,
  ],
  providers: [DocumentService, DocumentTemplateService],
  exports: [DocumentService, DocumentTemplateService],
  controllers: [DocumentController],
})
export class DocumentModule {}
