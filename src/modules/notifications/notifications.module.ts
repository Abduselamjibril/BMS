import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
// There are two service files: notification.service.ts and notifications.service.ts. Only one should be used as the main provider. Ensure the correct one is imported below.
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokenService } from './device-token.service';
import { NotificationProcessor } from './notification.processor';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity';
import { UserDeviceToken } from './entities/user-device-token.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, UserDeviceToken, User]),
    UsersModule,
    BullModule.registerQueue({
      name: 'notification',
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
  ],
  providers: [
    NotificationsService,
    PushNotificationService,
    DeviceTokenService,
    NotificationService,
    NotificationProcessor,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
// If you have both notification.service.ts and notifications.service.ts, this can cause confusion and only one will be registered. Remove or rename one to avoid issues.
