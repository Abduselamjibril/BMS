import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Lease } from '../leases/entities/lease.entity';
import * as bcrypt from 'bcryptjs';
import { Tenant, TenantStatus } from './entities/tenant.entity';
import {
  TenantApplication,
  TenantApplicationStatus,
} from './entities/tenant-application.entity';
import { TenantDocument } from './entities/tenant-document.entity';
import { Message } from './entities/message.entity';
import {
  Announcement,
  AnnouncementTarget,
} from './entities/announcement.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { Unit, UnitStatus } from '../units/entities/unit.entity';
import { Building } from '../buildings/entities/building.entity';
import { Site } from '../sites/entities/site.entity';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { CreateTenantApplicationDto } from './dto/create-tenant-application.dto';
import { CreateTenantDocumentDto } from './dto/create-tenant-document.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UserRole } from '../roles/entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
import { LeasesService } from '../leases/leases.service';
// RoleName enum removed
import { Owner } from '../owners/entities/owner.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantApplication)
    private readonly applicationRepository: Repository<TenantApplication>,
    @InjectRepository(TenantDocument)
    private readonly documentRepository: Repository<TenantDocument>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(require('../leases/entities/lease.entity').Lease)
    private readonly leaseRepository: Repository<any>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(Site)
    private readonly siteRepository: Repository<Site>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly leasesService: LeasesService,
  ) { }

  async register(dto: RegisterTenantDto): Promise<Tenant> {
    const userEmailExists = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (userEmailExists) {
      throw new ConflictException('Email already in use');
    }

    const tenantPhoneExists = await this.tenantRepository.findOne({
      where: { phone: dto.phone },
    });
    if (tenantPhoneExists) {
      throw new ConflictException('Phone already in use');
    }

    const tenantEmailExists = await this.tenantRepository.findOne({
      where: { email: dto.email },
    });
    if (tenantEmailExists) {
      throw new ConflictException('Tenant email already in use');
    }

    const user = this.userRepository.create({
      name: `${dto.first_name} ${dto.last_name}`,
      email: dto.email,
      password_hash: await bcrypt.hash(dto.password, 10),
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);

    let tenantRole = await this.roleRepository.findOne({
      where: { name: 'tenant' },
    });
    if (!tenantRole) {
      tenantRole = this.roleRepository.create({
        name: 'tenant',
        type: 'system' as any,
        description: 'Default Tenant Role',
      });
      await this.roleRepository.save(tenantRole);
    }

    const userRole = this.userRoleRepository.create({
      user: savedUser,
      role: tenantRole,
    });
    await this.userRoleRepository.save(userRole);

    const tenant = this.tenantRepository.create({
      user: savedUser,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
      email: dto.email,
      tin_number: dto.tin_number,
      vat_reg_number: dto.vat_reg_number,
      status: dto.status ?? TenantStatus.ACTIVE,
    });

    // attach optional documentation fields if present
    if (dto.id_image) tenant.id_image = dto.id_image;
    if (dto.detailed_address) tenant.detailed_address = dto.detailed_address;
    if (dto.license_image) tenant.license_image = dto.license_image;
    if (dto.profile_image) tenant.profile_image = dto.profile_image;
    if (dto.tin_certificate_image) tenant.tin_certificate_image = dto.tin_certificate_image;

    return this.tenantRepository.save(tenant);
  }

  async findOne(id: string, userId?: string, roles: string[] = []): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (roles.includes('owner') && userId) {
      const owner = await this.ownerRepository.findOne({ where: { user: { id: userId } } });
      if (owner) {
        // Check if this tenant has any lease in owner's buildings
        const hasLease = await this.dataSource.getRepository(Lease).findOne({
          where: { tenant: { id: tenant.id }, unit: { building: { owner: { id: owner.id } } } }
        });
        if (!hasLease) {
          throw new ForbiddenException('You do not have access to this tenant');
        }
      }
    }

    return tenant;
  }

  async findAllTenants(currentUserId: string): Promise<any[]> {
    const roles = await this.userRoleRepository.find({
      where: { user: { id: currentUserId } },
      relations: ['role'],
    });

    const allowedRoles = ['super_admin', 'admin', 'site_admin', 'contractor', 'tenant', 'nominee_admin', 'owner'];
    const isAllowed = roles.some((role) => allowedRoles.includes(role.role.name));
    if (!isAllowed) {
      throw new ForbiddenException('Insufficient permissions to view tenants');
    }

    const isOwner = roles.some((role) => role.role.name === 'owner');
    let where: any = {};

    if (isOwner) {
      const owner = await this.ownerRepository.findOne({ where: { user: { id: currentUserId } } });
      if (!owner) return [];

      // Find all building IDs owned by this owner
      const buildings = await this.buildingRepository.find({
        where: { owner: { id: owner.id } },
        select: ['id'],
      });
      const buildingIds = buildings.map((b) => b.id);
      if (buildingIds.length === 0) return [];

      // Find all tenants with active or draft leases in these buildings
      const activeLeases = await this.leaseRepository.find({
        where: { building: { id: In(buildingIds) } },
        relations: ['tenant'],
      });
      const tenantIds = [...new Set(activeLeases.map((l) => l.tenant.id))];
      if (tenantIds.length === 0) return [];

      where = { id: In(tenantIds) };
    }

    const tenants = await this.tenantRepository.find({
      where,
      order: { created_at: 'DESC' },
    });

    if (tenants.length === 0) return tenants;

    const tenantIds = tenants.map(t => t.id);
    const leases = await this.leaseRepository.find({
      where: { tenant: { id: In(tenantIds) } },
      relations: ['tenant', 'building', 'unit'],
      order: { created_at: 'DESC' },
    });

    return tenants.map(t => {
      const activeLease = leases.find(l => l.tenant.id === t.id && ['ACTIVE', 'RENEWED'].includes(l.status)) || leases.find(l => l.tenant.id === t.id);
      return {
        ...t,
        lease: activeLease || null
      };
    });
  }

  async updateTenant(id: string, dto: Record<string, any>, userId?: string, roles: string[] = []): Promise<Tenant> {
    const tenant = await this.findOne(id, userId, roles);

    if (dto.email && dto.email !== tenant.email) {
      const emailExists = await this.tenantRepository.findOne({
        where: { email: dto.email },
      });
      if (emailExists) throw new ConflictException('Email already in use');
      tenant.email = dto.email;
      if (tenant.user) {
        tenant.user.email = dto.email;
        await this.userRepository.save(tenant.user);
      }
    }

    if (dto.phone && dto.phone !== tenant.phone) {
      const phoneExists = await this.tenantRepository.findOne({
        where: { phone: dto.phone },
      });
      if (phoneExists) throw new ConflictException('Phone already in use');
      tenant.phone = dto.phone;
    }

    if (dto.first_name !== undefined) {
      tenant.first_name = dto.first_name;
    }
    if (dto.last_name !== undefined) {
      tenant.last_name = dto.last_name;
    }

    if (
      tenant.user &&
      (dto.first_name !== undefined || dto.last_name !== undefined)
    ) {
      tenant.user.name =
        `${tenant.first_name} ${tenant.last_name || ''}`.trim();
      await this.userRepository.save(tenant.user);
    }

    if (dto.tin_number !== undefined) tenant.tin_number = dto.tin_number;
    if (dto.vat_reg_number !== undefined)
      tenant.vat_reg_number = dto.vat_reg_number;
    if (dto.status !== undefined) tenant.status = dto.status;
    if (dto.detailed_address !== undefined) tenant.detailed_address = dto.detailed_address;
    if (dto.id_image !== undefined) tenant.id_image = dto.id_image;
    if (dto.license_image !== undefined) tenant.license_image = dto.license_image;
    if (dto.profile_image !== undefined) tenant.profile_image = dto.profile_image;

    return this.tenantRepository.save(tenant);
  }

  async createApplication(
    dto: CreateTenantApplicationDto,
  ): Promise<TenantApplication> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: dto.tenant_id },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const unit = await this.unitRepository.findOne({
      where: { id: dto.unit_id },
      relations: ['building'],
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    if (unit.status !== UnitStatus.VACANT) {
      throw new BadRequestException('Unit must be vacant for application');
    }

    const building = await this.buildingRepository.findOne({
      where: { id: dto.building_id },
    });
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    if (unit.building.id !== building.id) {
      throw new BadRequestException(
        'Unit does not belong to the selected building',
      );
    }

    const activeApplication = await this.applicationRepository.findOne({
      where: {
        tenant: { id: dto.tenant_id },
        status: In([
          TenantApplicationStatus.SUBMITTED,
          TenantApplicationStatus.REVIEWING,
          TenantApplicationStatus.APPROVED,
        ]),
      },
      relations: ['tenant'],
    });

    if (activeApplication) {
      throw new ConflictException('Tenant already has an active application');
    }

    const application = this.applicationRepository.create({
      tenant,
      unit,
      building,
      move_in_date: dto.move_in_date,
      status: TenantApplicationStatus.SUBMITTED,
    });

    return this.applicationRepository.save(application);
  }

  async listPendingApplications(): Promise<TenantApplication[]> {
    return this.applicationRepository.find({
      where: {
        status: In([
          TenantApplicationStatus.SUBMITTED,
          TenantApplicationStatus.REVIEWING,
        ]),
      },
      relations: ['tenant', 'unit', 'building', 'reviewed_by'],
      order: { created_at: 'DESC' },
    });
  }

  async verifyDocument(
    id: string,
    dto: VerifyDocumentDto,
  ): Promise<TenantDocument> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!dto.verified && !dto.reject_reason) {
      throw new BadRequestException(
        'reject_reason is required when verification is rejected',
      );
    }

    document.verified = dto.verified;
    document.reject_reason = dto.verified
      ? (null as unknown as string)
      : dto.reject_reason;
    return this.documentRepository.save(document);
  }

  async createTenantDocumentFromTenantImage(
    tenantId: string,
    type: string,
    authenticatedUser?: any,
  ): Promise<TenantDocument> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Map requested document type to tenant image fields
    let fileUrl: string | undefined;
    const t = (type || '').toUpperCase();
    if (['PRIMARY_ID', 'ID', 'PASSPORT'].includes(t)) {
      fileUrl = tenant.id_image as any;
    } else if (t === 'CONTRACT') {
      fileUrl = tenant.license_image as any;
    } else if (t === 'PROFILE') {
      fileUrl = tenant.profile_image as any;
    }

    if (!fileUrl) {
      throw new BadRequestException('No tenant image available for the requested type');
    }

    const created = await this.createTenantDocument(
      { tenant_id: tenantId, type: type as any, file_url: fileUrl },
      authenticatedUser,
    );

    // Auto-verify the created document
    const verified = await this.verifyDocument(created.id, { verified: true });
    return verified;
  }

  async verifyAllTenantImages(
    tenantId: string,
    authenticatedUser?: any,
  ): Promise<TenantDocument[]> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const results: TenantDocument[] = [];
    const types = ['ID', 'CONTRACT', 'PROFILE'];

    for (const type of types) {
      try {
        const doc = await this.createTenantDocumentFromTenantImage(
          tenantId,
          type,
          authenticatedUser,
        );
        results.push(doc);
      } catch (err) {
        // ignore types that don't have images
      }
    }
    return results;
  }

  async approveApplication(id: string): Promise<TenantApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: ['tenant', 'unit', 'building'],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (
      application.status !== TenantApplicationStatus.SUBMITTED &&
      application.status !== TenantApplicationStatus.REVIEWING
    ) {
      throw new BadRequestException(
        'Only submitted or reviewing applications can be approved',
      );
    }

    application.status = TenantApplicationStatus.APPROVED;
    application.reviewed_at = new Date();
    await this.applicationRepository.save(application);

    // Auto-create a draft lease
    try {
      const startDate = application.move_in_date;
      const start = new Date(startDate);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);

      await this.leasesService.create({
        tenant_id: application.tenant.id,
        unit_id: application.unit.id,
        building_id: application.building.id,
        start_date: startDate,
        end_date: end.toISOString().split('T')[0],
        rent_amount: Number(application.unit.rent_price) || 0,
        service_charge: 0,
      });
    } catch (err) {
      // In a production environment, we might want to handle this differently,
      // but here we allow the application approval to stand even if lease creation fails
      console.error('Failed to auto-create draft lease:', err.message);
    }

    return application;
  }

  async rejectApplication(id: string): Promise<TenantApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    application.status = TenantApplicationStatus.REJECTED;
    application.reviewed_at = new Date();
    return this.applicationRepository.save(application);
  }

  async createTenantDocument(
    dto: CreateTenantDocumentDto,
    authenticatedUser?: any,
  ): Promise<TenantDocument> {
    if (authenticatedUser) {
      const currentUserId = authenticatedUser.id || authenticatedUser.sub;
      const userRoles = await this.userRoleRepository.find({
        where: { user: { id: currentUserId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map((ur) => ur.role.name);

      if (roleNames.includes('tenant')) {
        const tenant = await this.tenantRepository.findOne({
          where: { user: { id: currentUserId } },
        });
        if (!tenant || tenant.id !== dto.tenant_id) {
          throw new ForbiddenException(
            'You can only upload documents for yourself',
          );
        }
      }
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: dto.tenant_id },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const document = this.documentRepository.create({
      tenant,
      type: dto.type,
      file_url: dto.file_url,
      verified: false,
    });

    return this.documentRepository.save(document);
  }

  async listTenantDocuments(
    tenantId?: string,
    authenticatedUser?: any,
  ): Promise<any[]> {
    let finalTenantId = tenantId;

    if (authenticatedUser) {
      const currentUserId = authenticatedUser.id || authenticatedUser.sub;
      const userRoles = await this.userRoleRepository.find({
        where: { user: { id: currentUserId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map((ur) => ur.role.name);

      if (roleNames.includes('tenant')) {
        const tenant = await this.tenantRepository.findOne({
          where: { user: { id: currentUserId } },
        });
        if (!tenant) return [];
        finalTenantId = tenant.id;
      }
    }

    const where = finalTenantId ? { tenant: { id: finalTenantId } } : {};
    const documents = await this.documentRepository.find({
      where,
      relations: ['tenant'],
      order: { created_at: 'DESC' },
    });

    return documents.map((doc) => ({
      id: doc.id,
      tenant_id: doc.tenant.id,
      type: doc.type,
      file_url: doc.file_url,
      verified: doc.verified,
      reject_reason: doc.reject_reason,
      created_at: doc.created_at,
    }));
  }

  async createAnnouncement(
    dto: CreateAnnouncementDto,
    creatorUserId: string,
  ): Promise<Announcement> {
    const creator = await this.userRepository.findOne({
      where: { id: creatorUserId },
    });
    if (!creator) {
      throw new NotFoundException('Creator user not found');
    }

    let building: Building | undefined;
    let site: Site | undefined;

    if (dto.target === AnnouncementTarget.BUILDING) {
      if (!dto.building_id) {
        throw new BadRequestException(
          'building_id is required when target is building',
        );
      }
      const foundBuilding = await this.buildingRepository.findOne({
        where: { id: dto.building_id },
      });
      if (!foundBuilding) {
        throw new NotFoundException('Building not found');
      }
      building = foundBuilding;
    }

    if (dto.target === AnnouncementTarget.SITE) {
      if (!dto.site_id) {
        throw new BadRequestException(
          'site_id is required when target is site',
        );
      }
      const foundSite = await this.siteRepository.findOne({
        where: { id: dto.site_id },
      });
      if (!foundSite) {
        throw new NotFoundException('Site not found');
      }
      site = foundSite;
    }

    const announcement = this.announcementRepository.create({
      title: dto.is_emergency ? `🚨 EMERGENCY: ${dto.title}` : dto.title,
      message: dto.message,
      target: dto.target,
      building,
      site,
      created_by: creator,
      scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : new Date(),
      is_emergency: !!dto.is_emergency,
    });

    const savedAnnouncement =
      await this.announcementRepository.save(announcement);

    // Bulk notify users based on target
    let userIds: string[] = [];
    if (dto.target === AnnouncementTarget.BUILDING && dto.building_id) {
      // Find all tenants in the building via active leases
      const leases = await this.leaseRepository.find({
        where: { building: { id: dto.building_id }, status: 'active' },
        relations: ['tenant', 'tenant.user'],
      });
      userIds = leases.map((l) => l.tenant.user.id);
    } else if (dto.target === AnnouncementTarget.SITE && dto.site_id) {
      // Find all tenants in the site via active leases
      const buildings = await this.buildingRepository.find({
        where: { site: { id: dto.site_id } },
      });
      const buildingIds = buildings.map((b) => b.id);
      const leases = await this.leaseRepository.find({
        where: { building: { id: In(buildingIds) }, status: 'active' },
        relations: ['tenant', 'tenant.user'],
      });
      userIds = leases.map((l) => l.tenant.user.id);
    } else if (dto.target === AnnouncementTarget.ALL) {
      // All tenants
      const tenants = await this.tenantRepository.find({ relations: ['user'] });
      userIds = tenants.map((t) => t.user.id);
    }
    for (const userId of userIds) {
      await this.notificationsService.notify(
        userId,
        'Announcement',
        dto.title + '\n' + dto.message,
        NotificationType.ANNOUNCEMENT,
        { announcementId: savedAnnouncement.id, target: dto.target },
      );
    }
    return savedAnnouncement;
  }

  async findAnnouncements(
    siteId?: string,
    buildingId?: string,
    authenticatedUser?: any,
  ): Promise<any[]> {
    const query = this.announcementRepository
      .createQueryBuilder('announcement')
      .leftJoinAndSelect('announcement.site', 'site')
      .leftJoinAndSelect('announcement.building', 'building')
      .leftJoinAndSelect('announcement.created_by', 'createdBy')
      .orderBy('announcement.created_at', 'DESC');

    let finalSiteId = siteId;
    let finalBuildingId = buildingId;

    if (authenticatedUser) {
      const currentUserId = authenticatedUser.id || authenticatedUser.sub;
      const userRoles = await this.userRoleRepository.find({
        where: { user: { id: currentUserId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map((ur) => ur.role.name);

      if (roleNames.includes('tenant')) {
        const tenant = await this.tenantRepository.findOne({
          where: { user: { id: currentUserId } },
          relations: ['user'],
        });
        if (tenant) {
          const activeLease = await this.leaseRepository.findOne({
            where: { tenant: { id: tenant.id }, status: 'ACTIVE' },
            relations: ['unit', 'unit.building', 'unit.building.site'],
          });
          if (activeLease && activeLease.unit && activeLease.unit.building) {
            finalBuildingId = activeLease.unit.building.id;
            finalSiteId = activeLease.unit.building.site?.id;
          }
        }
      }
    }

    // Filter logic: Show if target is ALL OR matches building OR matches site
    query.where('announcement.target = :all', { all: AnnouncementTarget.ALL });

    if (finalSiteId) {
      query.orWhere('announcement.site.id = :sId', { sId: finalSiteId });
    }

    if (finalBuildingId) {
      query.orWhere('announcement.building.id = :bId', { bId: finalBuildingId });
    }

    // Scheduling Filter: Only show published announcements to non-admins
    const now = new Date();
    const isAdmin = authenticatedUser?.roles?.some((r: string) => ['super_admin', 'company_admin'].includes(r));
    if (!isAdmin) {
      query.andWhere('announcement.scheduled_at <= :now', { now });
    }

    const announcements = await query.getMany();


    return announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      target: announcement.target,
      site: announcement.site
        ? {
          id: announcement.site.id,
          name: announcement.site.name,
          city: announcement.site.city,
          subcity: announcement.site.subcity,
        }
        : null,
      building: announcement.building
        ? {
          id: announcement.building.id,
          name: announcement.building.name,
          code: announcement.building.code,
        }
        : null,
      created_by: announcement.created_by
        ? {
          id: announcement.created_by.id,
          name: announcement.created_by.name,
          email: announcement.created_by.email,
        }
        : null,
      created_at: announcement.created_at,
    }));
  }

  async sendMessage(
    dto: SendMessageDto,
    senderUserId: string,
  ): Promise<Message> {
    const sender = await this.userRepository.findOne({
      where: { id: senderUserId },
    });
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: dto.tenant_id },
      relations: ['user'],
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const message = this.messageRepository.create({
      sender,
      receiver: tenant.user,
      content: dto.content,
      read_status: false,
    });

    const saved = await this.messageRepository.save(message);

    // Trigger notification for the receiver
    await this.notificationsService.notify(
      tenant.user.id,
      'New Direct Message',
      dto.content.length > 60
        ? dto.content.substring(0, 57) + '...'
        : dto.content,
      NotificationType.SYSTEM,
      { message_id: saved.id, sender_id: senderUserId },
    );

    return saved;
  }

  async getChatHistory(
    tenantId: string,
    currentUserId: string,
  ): Promise<any[]> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: ['user'],
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const tenantUserId = tenant.user.id;

    let messages: Message[];

    if (currentUserId === tenantUserId) {
      messages = await this.messageRepository.find({
        where: [
          { sender: { id: tenantUserId } },
          { receiver: { id: tenantUserId } },
        ],
        relations: ['sender', 'receiver'],
        order: { sent_at: 'ASC' },
      });
    } else {
      messages = await this.messageRepository.find({
        where: [
          { sender: { id: currentUserId }, receiver: { id: tenantUserId } },
          { sender: { id: tenantUserId }, receiver: { id: currentUserId } },
        ],
        relations: ['sender', 'receiver'],
        order: { sent_at: 'ASC' },
      });
    }

    const unreadForCurrent = messages.filter(
      (message) =>
        message.receiver.id === currentUserId && !message.read_status,
    );

    if (unreadForCurrent.length > 0) {
      await this.messageRepository.update(
        { id: In(unreadForCurrent.map((message) => message.id)) },
        { read_status: true },
      );
      unreadForCurrent.forEach((message) => {
        message.read_status = true;
      });
    }

    return messages.map((message) => ({
      id: message.id,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        email: message.sender.email,
      },
      receiver: {
        id: message.receiver.id,
        name: message.receiver.name,
        email: message.receiver.email,
      },
      content: message.content,
      read_status: message.read_status,
      sent_at: message.sent_at,
    }));
  }

  async findMyLease(userId: string) {
    const tenant = await this.tenantRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!tenant) throw new NotFoundException('Tenant profile not found');

    const lease = await this.leaseRepository.findOne({
      where: { tenant: { id: tenant.id }, status: 'ACTIVE' },
      relations: ['unit', 'unit.building', 'unit.building.site'],
    });

    if (!lease) throw new NotFoundException('No active lease found');

    return lease;
  }
}
