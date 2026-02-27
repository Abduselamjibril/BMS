import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * GENERIC NOTIFICATION METHOD
   * Used by automation cron jobs, business logic, and internal events.
   */
  async notify(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    metadata?: Record<string, any>
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
    
    // Optionally: Trigger real-time push/socket here
    // this.sendPush({ title, body: message, userId });
    
    return saved;
  }

  /**
   * IN-APP NOTIFICATIONS MANAGEMENT
   */

  // Fetch all notifications for a specific user
  async getNotifications(userId: string) {
    return this.notificationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  // Bulk mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    const result = await this.notificationRepo.update(
      { user_id: userId, is_read: false },
      { is_read: true }
    );
    return { updated: result.affected };
  }

  // Delete notification by ID (ensuring it belongs to the user)
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
   */

  async announce(
    body: { title: string; message: string; type?: string; targetUserIds?: string[] },
    super_admin_id: string,
  ) {
    // 1. Determine target users (specific list or everyone)
    let userIds = body.targetUserIds;
    if (!userIds || userIds.length === 0) {
      userIds = await this.getAllUserIds();
    }

    // 2. Process notifications for each user
    const results: Notification[] = [];
    for (const userId of userIds) {
      const notification = this.notificationRepo.create({
        user_id: userId,
        title: body.title,
        message: body.message,
        type: body.type ? (body.type as NotificationType) : NotificationType.ANNOUNCEMENT,
        is_read: false,
      });
      
      const saved = await this.notificationRepo.save(notification);
      results.push(saved);

      // Trigger push for each announcement
      await this.sendPush({
        title: body.title,
        body: body.message,
        userId: userId,
        type: body.type || 'ANNOUNCEMENT'
      });
    }

    return { 
      sent_count: results.length, 
      status: 'Announcements processed successfully' 
    };
  }

  /**
   * HELPERS / EXTERNAL INTEGRATION
   */

  // Placeholder for FCM (Firebase Cloud Messaging) integration
  async sendPush(payload: { 
    title: string; 
    body: string; 
    topic?: string; 
    token?: string; 
    type?: string; 
    userId?: string 
  }) {
    // Logic to bridge with Firebase Admin SDK or other Push Providers
    console.log(`[Push Service] Sending to User ${payload.userId}: ${payload.title}`);
    
    return { 
      sent: true, 
      provider: 'FCM_STUB',
      timestamp: new Date().toISOString(),
      payload 
    };
  }

  // Fetch all active user IDs from the database for global announcements
  private async getAllUserIds(): Promise<string[]> {
    const users = await this.userRepo.find({ select: ['id'] });
    return users.map((u) => u.id);
  }

  // Wrapper for super admin announcement flows
  async sendAnnouncementNotification(
    userId: string,
    title: string,
    message: string,
    type?: string,
  ) {
    return this.sendPush({
      title,
      body: message,
      type: type || 'ANNOUNCEMENT',
      userId,
    });
  }
}