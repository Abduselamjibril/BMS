import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Tenant, TenantStatus } from './entities/tenant.entity';
import {
  TenantApplication,
  TenantApplicationStatus,
} from './entities/tenant-application.entity';
import { TenantDocument } from './entities/tenant-document.entity';
import { Message } from './entities/message.entity';
import { Announcement, AnnouncementTarget } from './entities/announcement.entity';
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
import { RoleName } from '../roles/entities/role.entity';

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
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(Site)
    private readonly siteRepository: Repository<Site>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async register(dto: RegisterTenantDto): Promise<Tenant> {
    const userEmailExists = await this.userRepository.findOne({ where: { email: dto.email } });
    if (userEmailExists) {
      throw new ConflictException('Email already in use');
    }

    const tenantPhoneExists = await this.tenantRepository.findOne({ where: { phone: dto.phone } });
    if (tenantPhoneExists) {
      throw new ConflictException('Phone already in use');
    }

    const tenantEmailExists = await this.tenantRepository.findOne({ where: { email: dto.email } });
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

    return this.tenantRepository.save(tenant);
  }

  async findAllTenants(currentUserId: string): Promise<Tenant[]> {
    const roles = await this.userRoleRepository.find({
      where: { user: { id: currentUserId } },
      relations: ['role'],
    });

    const isSuperAdmin = roles.some((role) => role.role.name === RoleName.SUPER_ADMIN);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super admins can view tenants');
    }

    return this.tenantRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async createApplication(dto: CreateTenantApplicationDto): Promise<TenantApplication> {
    const tenant = await this.tenantRepository.findOne({ where: { id: dto.tenant_id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const unit = await this.unitRepository.findOne({ where: { id: dto.unit_id }, relations: ['building'] });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    if (unit.status !== UnitStatus.VACANT) {
      throw new BadRequestException('Unit must be vacant for application');
    }

    const building = await this.buildingRepository.findOne({ where: { id: dto.building_id } });
    if (!building) {
      throw new NotFoundException('Building not found');
    }

    if (unit.building.id !== building.id) {
      throw new BadRequestException('Unit does not belong to the selected building');
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
      where: { status: In([TenantApplicationStatus.SUBMITTED, TenantApplicationStatus.REVIEWING]) },
      relations: ['tenant', 'unit', 'building', 'reviewed_by'],
      order: { created_at: 'DESC' },
    });
  }

  async verifyDocument(id: string, dto: VerifyDocumentDto): Promise<TenantDocument> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!dto.verified && !dto.reject_reason) {
      throw new BadRequestException('reject_reason is required when verification is rejected');
    }

    document.verified = dto.verified;
    document.reject_reason = dto.verified ? null as unknown as string : dto.reject_reason;
    return this.documentRepository.save(document);
  }

  async createTenantDocument(dto: CreateTenantDocumentDto): Promise<TenantDocument> {
    const tenant = await this.tenantRepository.findOne({ where: { id: dto.tenant_id } });
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

  async listTenantDocuments(tenantId?: string): Promise<any[]> {
    const where = tenantId ? { tenant: { id: tenantId } } : {};
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

  async createAnnouncement(dto: CreateAnnouncementDto, creatorUserId: string): Promise<Announcement> {
    const creator = await this.userRepository.findOne({ where: { id: creatorUserId } });
    if (!creator) {
      throw new NotFoundException('Creator user not found');
    }

    let building: Building | undefined;
    let site: Site | undefined;

    if (dto.target === AnnouncementTarget.BUILDING) {
      if (!dto.building_id) {
        throw new BadRequestException('building_id is required when target is building');
      }
      const foundBuilding = await this.buildingRepository.findOne({ where: { id: dto.building_id } });
      if (!foundBuilding) {
        throw new NotFoundException('Building not found');
      }
      building = foundBuilding;
    }

    if (dto.target === AnnouncementTarget.SITE) {
      if (!dto.site_id) {
        throw new BadRequestException('site_id is required when target is site');
      }
      const foundSite = await this.siteRepository.findOne({ where: { id: dto.site_id } });
      if (!foundSite) {
        throw new NotFoundException('Site not found');
      }
      site = foundSite;
    }

    const announcement = this.announcementRepository.create({
      title: dto.title,
      message: dto.message,
      target: dto.target,
      building,
      site,
      created_by: creator,
    });

    return this.announcementRepository.save(announcement);
  }

  async findAnnouncements(siteId?: string, buildingId?: string): Promise<any[]> {
    const query = this.announcementRepository
      .createQueryBuilder('announcement')
      .leftJoinAndSelect('announcement.site', 'site')
      .leftJoinAndSelect('announcement.building', 'building')
      .leftJoinAndSelect('announcement.created_by', 'createdBy')
      .orderBy('announcement.created_at', 'DESC');

    if (siteId) {
      query.andWhere('site.id = :siteId', { siteId });
    }

    if (buildingId) {
      query.andWhere('building.id = :buildingId', { buildingId });
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

  async sendMessage(dto: SendMessageDto, senderUserId: string): Promise<Message> {
    const sender = await this.userRepository.findOne({ where: { id: senderUserId } });
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: dto.tenant_id }, relations: ['user'] });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const message = this.messageRepository.create({
      sender,
      receiver: tenant.user,
      content: dto.content,
      read_status: false,
    });

    return this.messageRepository.save(message);
  }

  async getChatHistory(tenantId: string, currentUserId: string): Promise<any[]> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId }, relations: ['user'] });
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
      (message) => message.receiver.id === currentUserId && !message.read_status,
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
}
