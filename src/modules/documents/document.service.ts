import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DataSource } from 'typeorm';
import { Document, DocumentVersion } from './entities/document.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Lease } from '../leases/entities/lease.entity';
import { Payment } from '../finance/entities/payment.entity';
import { UserBuilding } from '../users/entities/user-building.entity';
import { Owner } from '../owners/entities/owner.entity';
import { Building } from '../buildings/entities/building.entity';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Owner)
    private readonly ownerRepo: Repository<Owner>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async uploadDocument(dto: any, file: Express.Multer.File, authorId?: string) {
    let targetModuleId = dto.module_id;
    let targetModuleType = dto.module_type;

    // Security check: if tenant, the module_id should be their tenant ID
    if (authorId) {
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: authorId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map((ur) => ur.role.name);
      const isTenant = roleNames.includes('tenant');
      const isOwner = roleNames.includes('owner');

      if (isTenant) {
        const tenant = await this.tenantRepo.findOne({
          where: { user: { id: authorId } },
        });
        if (tenant) {
          targetModuleId = tenant.id;
          targetModuleType = 'tenant';
        }
      } else if (isOwner) {
        const owner = await this.ownerRepo.findOne({ where: { user: { id: authorId } } });
        if (owner) {
          // Verify target module ownership
          if (targetModuleType === 'building') {
            const building = await this.dataSource.getRepository(Building).findOne({ where: { id: targetModuleId, owner: { id: owner.id } } });
            if (!building) throw new ForbiddenException('You do not have access to this building');
          } else if (targetModuleType === 'lease') {
            const lease = await this.dataSource.getRepository(Lease).findOne({ where: { id: targetModuleId, unit: { building: { owner: { id: owner.id } } } } });
            if (!lease) throw new ForbiddenException('You do not have access to this lease');
          } else if (targetModuleType === 'tenant') {
            const hasLease = await this.dataSource.getRepository(Lease).findOne({ where: { tenant: { id: targetModuleId }, unit: { building: { owner: { id: owner.id } } } } });
            if (!hasLease) throw new ForbiddenException('You do not have access to this tenant');
          }
        }
      }
    }

    const doc = this.documentRepo.create({
      file_name: file.originalname,
      mime_type: file.mimetype,
      file_size: file.size,
      storage_path: file.path,
      module_type: targetModuleType,
      module_id: targetModuleId,
      version: 1,
      is_deleted: false,
    });
    const savedDoc = await this.documentRepo.save(doc);

    // Notify manager/admin if document is uploaded for compliance
    if (targetModuleType === 'tenant' && dto.manager_id) {
      await this.notificationsService.notify(
        dto.manager_id,
        'Document Uploaded',
        `A new document has been uploaded by tenant ${targetModuleId}.`,
        NotificationType.SYSTEM,
        { documentId: savedDoc.id, tenantId: targetModuleId },
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

  async searchDocuments(filters: any, authenticatedUser?: any) {
    const { user, ...rest } = filters;
    const authUser = authenticatedUser || user;

    if (!authUser) {
      return this.documentRepo.find({ where: { ...rest, is_deleted: false } });
    }

    const currentUserId = authUser.id || authUser.sub;
    const userRoles = await this.userRoleRepo.find({
      where: { user: { id: currentUserId } },
      relations: ['role'],
    });
    const roleNames = userRoles.map((ur) => ur.role.name);

    const query = this.documentRepo
      .createQueryBuilder('document')
      .where('document.is_deleted = false');

    // 1. Super Admin: Filter by provided criteria only
    if (roleNames.includes('super_admin')) {
      if (rest.module_type)
        query.andWhere('document.module_type = :mt', { mt: rest.module_type });
      if (rest.module_id)
        query.andWhere('document.module_id = :mid', { mid: rest.module_id });
      if (rest.file_name)
        query.andWhere('document.file_name LIKE :fn', {
          fn: `%${rest.file_name}%`,
        });
    }
    // 2. Nominee Admin: Filter by assigned buildings
    else if (roleNames.includes('nominee_admin')) {
      const assignments = await this.dataSource
        .getRepository(UserBuilding)
        .find({
          where: { user: { id: currentUserId } },
          relations: ['building'],
        });
      const buildingIds = assignments.map((a) => a.building.id);

      // They see documents for their buildings, or tenant docs for tenants in their buildings
      // For now, simplify to building-scoped docs if searching for building docs
      if (rest.module_type === 'building' || !rest.module_type) {
        query.andWhere(
          'document.module_type = :mt AND document.module_id IN (:...bids)',
          { mt: 'building', bids: buildingIds },
        );
      } else {
        // restricted search
        query.andWhere('document.module_id IN (:...bids)', {
          bids: buildingIds,
        });
      }
    }
    // 3. Owner: Filter by owned buildings and related entities
    else if (roleNames.includes('owner')) {
      const owner = await this.ownerRepo.findOne({ where: { user: { id: currentUserId } } });
      if (!owner) return [];

      const buildings = await this.dataSource.getRepository(Building).find({
        where: { owner: { id: owner.id } },
        select: ['id'],
      });
      const buildingIds = buildings.map((b) => b.id);
      if (buildingIds.length === 0) return [];

      // Find all related entity IDs (leases, tenants, payments) in these buildings
      const leases = await this.dataSource.getRepository(Lease).find({
        where: { unit: { building: { id: In(buildingIds) } } },
        relations: ['tenant'],
        select: ['id'],
      });
      const leaseIds = leases.map(l => l.id);
      const tenantIds = [...new Set(leases.map(l => l.tenant?.id).filter(Boolean))];

      const payments = await this.dataSource.getRepository(Payment).find({
        where: { invoice: { unit: { building: { id: In(buildingIds) } } } },
        select: ['id'],
      });
      const paymentIds = payments.map(p => p.id);

      const conditions: string[] = [];
      const params: any = {};

      // Building docs
      conditions.push('(document.module_type = :bmt AND document.module_id IN (:...bids))');
      params.bmt = 'building';
      params.bids = buildingIds;

      // Lease docs
      if (leaseIds.length > 0) {
        conditions.push('(document.module_type = :lmt AND document.module_id IN (:...lids))');
        params.lmt = 'lease';
        params.lids = leaseIds;
      }

      // Tenant docs
      if (tenantIds.length > 0) {
        conditions.push('(document.module_type = :tmt AND document.module_id IN (:...tids))');
        params.tmt = 'tenant';
        params.tids = tenantIds;
      }

      // Payment docs
      if (paymentIds.length > 0) {
        conditions.push('(document.module_type = :pmt AND document.module_id IN (:...pids))');
        params.pmt = 'payment';
        params.pids = paymentIds;
      }

      query.andWhere(`(${conditions.join(' OR ')})`, params);
    }
    // 4. Tenant: Filter by their own tenant ID, associated lease IDs, or payment IDs
    else if (roleNames.includes('tenant')) {
      const tenant = await this.tenantRepo.findOne({
        where: { user: { id: currentUserId } },
      });
      if (!tenant) return [];

      const leases = await this.dataSource.getRepository(Lease).find({
        where: { tenant: { id: tenant.id } },
        select: ['id'],
      });
      const leaseIds = leases.map((l) => l.id);

      const payments = await this.dataSource.getRepository(Payment).find({
        where: { invoice: { tenant: { id: tenant.id } } },
        select: ['id'],
      });
      const paymentIds = payments.map((p) => p.id);

      const conditions: string[] = [
        '(document.module_id = :tid AND document.module_type = :tmt)',
      ];
      const params: any = { tid: tenant.id, tmt: 'tenant' };

      if (leaseIds.length > 0) {
        conditions.push(
          '(document.module_id IN (:...lids) AND document.module_type = :lmt)',
        );
        params.lids = leaseIds;
        params.lmt = 'lease';
      }
      if (paymentIds.length > 0) {
        conditions.push(
          '(document.module_id IN (:...pids) AND document.module_type = :pmt)',
        );
        params.pids = paymentIds;
        params.pmt = 'payment';
      }

      query.andWhere(`(${conditions.join(' OR ')})`, params);
    } else {
      // Default fallback
      if (rest.module_type)
        query.andWhere('document.module_type = :mt', { mt: rest.module_type });
      if (rest.module_id)
        query.andWhere('document.module_id = :mid', { mid: rest.module_id });
    }

    const docs = await query.getMany();
    
    // Enrich with labels
    const enriched = await Promise.all(docs.map(async (doc) => {
      let label = doc.module_id;
      try {
        if (doc.module_type === 'building') {
          const b = await this.dataSource.getRepository('Building').findOne({ where: { id: doc.module_id } });
          if (b) label = (b as any).name || (b as any).code || label;
        } else if (doc.module_type === 'tenant') {
          const t = await this.dataSource.getRepository('Tenant').findOne({ where: { id: doc.module_id } });
          if (t) label = `${(t as any).first_name || ''} ${(t as any).last_name || ''}`.trim() || (t as any).email || label;
        } else if (doc.module_type === 'lease') {
          const l = await this.dataSource.getRepository('Lease').findOne({ where: { id: doc.module_id }, relations: ['unit'] });
          if (l) label = `Lease: Unit ${(l as any).unit?.unit_number || 'N/A'}`;
        }
      } catch (e) { /* ignore enrichment failures */ }
      
      return { ...doc, module_label: label };
    }));

    return enriched;
  }

  async getDocumentHistory(id: string, authenticatedUser?: any) {
    // We should verify access to the document first
    await this.verifyDocumentAccess(id, authenticatedUser);
    // List all previous versions
    return this.versionRepo.find({
      where: { document_id: id },
      order: { version_number: 'DESC' },
    });
  }

  private async verifyDocumentAccess(id: string, authenticatedUser?: any) {
    if (!authenticatedUser) return;
    const userId = authenticatedUser.id || authenticatedUser.sub;
    const userRoles = await this.userRoleRepo.find({
      where: { user: { id: userId } },
      relations: ['role'],
    });
    const roleNames = userRoles.map(r => r.role.name);

    if (roleNames.includes('super_admin')) return;

    const doc = await this.documentRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    if (roleNames.includes('owner')) {
      const owner = await this.ownerRepo.findOne({ where: { user: { id: userId } } });
      if (owner) {
        if (doc.module_type === 'building') {
          const b = await this.dataSource.getRepository(Building).findOne({ where: { id: doc.module_id, owner: { id: owner.id } } });
          if (!b) throw new ForbiddenException('Access denied');
        } else if (doc.module_type === 'lease') {
          const l = await this.dataSource.getRepository(Lease).findOne({ where: { id: doc.module_id, unit: { building: { owner: { id: owner.id } } } } });
          if (!l) throw new ForbiddenException('Access denied');
        } else if (doc.module_type === 'tenant') {
          const hasLease = await this.dataSource.getRepository(Lease).findOne({ where: { tenant: { id: doc.module_id }, unit: { building: { owner: { id: owner.id } } } } });
          if (!hasLease) throw new ForbiddenException('Access denied');
        }
      }
    }
    // Tenant access logic can be added here if needed
  }

  async softDeleteDocument(id: string, authenticatedUser?: any) {
    await this.verifyDocumentAccess(id, authenticatedUser);
    // Mark as is_deleted
    return this.documentRepo.update(id, { is_deleted: true });
  }
}
