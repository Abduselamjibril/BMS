import { Injectable } from '@nestjs/common';
import { firebaseApp } from '../../config/firebase-admin';
import * as admin from 'firebase-admin';

@Injectable()
export class PushNotificationService {
  async sendPush(userTokens: string[], title: string, body: string, data?: Record<string, any>) {
    if (!userTokens.length) return { sent: false, reason: 'No tokens' };

    const message: admin.messaging.MulticastMessage = {
      notification: { title, body },
      tokens: userTokens,
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
    };

    const response = await firebaseApp.messaging().sendEachForMulticast(message);
    return { sent: true, response };
  }
}
