import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { Lease } from '../leases/entities/lease.entity';
import { Building } from '../buildings/entities/building.entity';
import { Site } from '../sites/entities/site.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<any>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectQueue('notification')
    private readonly notificationQueue: Queue,
  ) {}

  /**
   * GENERIC NOTIFICATION METHOD
   */
  async notify(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    metadata?: Record<string, any>,
  ) {
    const notification = this.notificationRepo.create({
      user_id: userId,
      title,
      message,
      type,
      metadata: metadata || {},
      is_read: false,
    });

    const saved = await this.notificationRepo.save(notification);

    await this.notificationQueue.add('process-notification', {
      userId,
      title,
      message,
      type,
    });

    return saved;
  }

  /**
   * IN-APP NOTIFICATIONS MANAGEMENT
   */

  async getNotifications(userId: string) {
    return this.notificationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationRepo.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
    return { updated: result.affected };
  }

  async markAsRead(id: string, userId: string) {
    const result = await this.notificationRepo.update(
      { id, user_id: userId, is_read: false },
      { is_read: true },
    );
    return { updated: result.affected };
  }

  async deleteNotification(id: string, userId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id, user_id: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found or access denied');
    }

    await this.notificationRepo.remove(notification);
    return { deleted: true };
  }

  /**
   * SYSTEM ANNOUNCEMENTS (SUPER ADMIN)
   * Supports targeting: everyone, specific building, or specific site.
   */
  async announce(
    body: {
      title: string;
      message: string;
      type?: string;
      targetUserIds?: string[];
      buildingId?: string;
      siteId?: string;
    },
    super_admin_id: string,
  ) {
    let userIds: string[] = [];

    if (body.buildingId) {
      // Target: All tenants in a specific building
      userIds = await this.getUserIdsByBuilding(body.buildingId);
      this.logger.log(`Targeted broadcast to building ${body.buildingId}: ${userIds.length} users`);
    } else if (body.siteId) {
      // Target: All tenants across all buildings in a site
      userIds = await this.getUserIdsBySite(body.siteId);
      this.logger.log(`Targeted broadcast to site ${body.siteId}: ${userIds.length} users`);
    } else if (body.targetUserIds && body.targetUserIds.length > 0) {
      // Target: Specific user IDs
      userIds = body.targetUserIds;
    } else {
      // Target: Everyone
      userIds = await this.getAllUserIds();
    }

    if (userIds.length === 0) return { sent_count: 0, status: 'No users found for this target' };

    const type = body.type ? (body.type as NotificationType) : NotificationType.ANNOUNCEMENT;

    const notificationsToInsert = userIds.map(userId => ({
      user_id: userId,
      title: body.title,
      message: body.message,
      type: type,
      is_read: false,
    }));

    // Bulk insert
    await this.notificationRepo.createQueryBuilder()
      .insert()
      .into(Notification)
      .values(notificationsToInsert)
      .execute();

    // Dispatch background processing (Email + Push)
    for (const userId of userIds) {
      await this.notificationQueue.add('process-notification', {
        userId,
        title: body.title,
        message: body.message,
        type: type,
      });
    }

    return {
      sent_count: userIds.length,
      status: 'Announcements processed successfully',
    };
  }

  /**
   * TARGETING HELPERS
   */

  private async getAllUserIds(): Promise<string[]> {
    const users = await this.userRepo.find({ select: ['id'] });
    return users.map((u) => u.id);
  }

  private async getUserIdsByBuilding(buildingId: string): Promise<string[]> {
    const leases = await this.leaseRepo.find({
      where: { building: { id: buildingId }, status: 'ACTIVE' },
      relations: ['tenant', 'tenant.user'],
    });
    const ids = leases
      .filter((l: any) => l.tenant?.user?.id)
      .map((l: any) => l.tenant.user.id);
    return [...new Set(ids)]; // deduplicate
  }

  private async getUserIdsBySite(siteId: string): Promise<string[]> {
    const buildings = await this.buildingRepo.find({
      where: { site: { id: siteId } },
      select: ['id'],
    });
    if (buildings.length === 0) return [];
    const buildingIds = buildings.map(b => b.id);
    const leases = await this.leaseRepo.find({
      where: { building: { id: In(buildingIds) }, status: 'ACTIVE' },
      relations: ['tenant', 'tenant.user'],
    });
    const ids = leases
      .filter((l: any) => l.tenant?.user?.id)
      .map((l: any) => l.tenant.user.id);
    return [...new Set(ids)];
  }
}
