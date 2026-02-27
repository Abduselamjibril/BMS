import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { Document, DocumentVersion } from './entities/document.entity';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepo: Repository<DocumentVersion>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async uploadDocument(dto: any, file: Express.Multer.File) {
    // Save file to disk, metadata to DB
    const doc = this.documentRepo.create({
      file_name: file.originalname,
      mime_type: file.mimetype,
      file_size: file.size,
      storage_path: file.path,
      module_type: dto.module_type,
      module_id: dto.module_id,
      version: 1,
      is_deleted: false,
    });
    const savedDoc = await this.documentRepo.save(doc);

    // Notify manager/admin if document is uploaded for compliance
    if (dto.module_type === 'tenant' && dto.manager_id) {
      await this.notificationsService.notify(
        dto.manager_id,
        'Document Uploaded',
        `A new document has been uploaded by tenant ${dto.tenant_id}.`,
        NotificationType.SYSTEM,
        { documentId: savedDoc.id, tenantId: dto.tenant_id }
      );
    }
    return savedDoc;
  }

  async updateDocument(id: string, file: Express.Multer.File) {
    // Archive old version, update document
    const doc = await this.documentRepo.findOne({ where: { id } });
    if (!doc) throw new Error('Document not found');
    await this.versionRepo.save({
      document_id: doc.id,
      version_number: doc.version,
      storage_path: doc.storage_path,
      uploaded_at: new Date(),
    });
    doc.file_name = file.originalname;
    doc.mime_type = file.mimetype;
    doc.file_size = file.size;
    doc.storage_path = file.path;
    doc.version += 1;
    return this.documentRepo.save(doc);
  }

  async searchDocuments(filters: any) {
    // Always exclude deleted documents
    const baseFilters = { ...filters, is_deleted: false };
    // Scoped access: nominee admins only see docs for assigned buildings
    if (filters.user && filters.user.role === 'nominee_admin') {
      // Find assigned buildings
      const assignments = await this.dataSource.getRepository('UserBuilding').find({ where: { user: { id: filters.user.id } }, relations: ['building'] });
      const buildingIds = assignments.map(a => a.building.id);
      // Filter documents for these buildings
      return this.documentRepo.createQueryBuilder('document')
        .where('document.module_type = :moduleType AND document.module_id IN (:...buildingIds) AND document.is_deleted = false', { moduleType: 'building', buildingIds })
        .getMany();
    }
    // Tenants and super admins: fallback to filters
    return this.documentRepo.find({ where: baseFilters });
  }

  async getDocumentHistory(id: string) {
    // List all previous versions
    return this.versionRepo.find({ where: { document_id: id }, order: { version_number: 'DESC' } });
  }

  async softDeleteDocument(id: string) {
    // Mark as is_deleted
    return this.documentRepo.update(id, { is_deleted: true });
  }
}
