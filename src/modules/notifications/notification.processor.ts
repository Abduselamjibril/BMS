import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PushNotificationService } from './push-notification.service';

@Processor('notification')
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {
    super();
  }

  async process(job: any) {
    const { userId, title, message, data } = job.data;
    // Fetch tokens and send push
    // You may want to fetch tokens from DeviceTokenService
    // For now, assume pushNotificationService handles token lookup
    await this.pushNotificationService.sendPush([userId], title, message, data);
  }
}
