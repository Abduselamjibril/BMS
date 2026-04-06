import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokenService } from './device-token.service';
import { MailService } from './mail.service';

@Processor('notification')
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(job: any) {
    // We now use a single job 'process-notification' for both Email and Push
    const { userId, title, message, data } = job.data;
    
    // 1. Dispatch Email in background
    await this.mailService.sendEmail(userId, title, message);

    // 2. Dispatch Push in background
    const tokens = await this.deviceTokenService.getTokensByUser(userId);
    if (tokens && tokens.length > 0) {
      await this.pushNotificationService.sendPush(tokens, title, message, data);
    }
  }
}
