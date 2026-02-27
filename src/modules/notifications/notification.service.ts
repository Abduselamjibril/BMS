import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectQueue('notification')
    private readonly notificationQueue: Queue,
  ) {}

  async notify(userId: string, title: string, message: string, data?: Record<string, any>) {
    // Save notification to DB
    const notification = this.notificationRepo.create({
      user_id: userId,
      title,
      message,
      type: NotificationType.SYSTEM, // or another NotificationType as needed
      metadata: data,
      is_read: false,
    });
    await this.notificationRepo.save(notification);
    // Dispatch BullMQ job
    await this.notificationQueue.add('send-push-job', {
      userId,
      title,
      message,
      data,
    });
    return notification;
  }
}
