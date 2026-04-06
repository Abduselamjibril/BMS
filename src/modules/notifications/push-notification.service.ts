import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { firebaseApp } from '../../config/firebase-admin';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  async sendPush(tokens: string[], title: string, body: string, data?: any) {
    if (!tokens || tokens.length === 0) return;
    if (!firebaseApp) {
      this.logger.warn('Firebase App is not initialized. Skipping push dispatch.');
      return;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        data: data || {},
        tokens: tokens,
      };

      const response = await firebaseApp.messaging().sendEachForMulticast(message);
      this.logger.log(`Push sent successfully. Success: ${response.successCount}, Failures: ${response.failureCount}`);
    } catch (error) {
      this.logger.error('Failed to dispatch push notification via Firebase', error);
    }
  }
}
