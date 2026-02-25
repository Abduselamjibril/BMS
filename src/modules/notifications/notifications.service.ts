import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  // Placeholder for FCM integration
  async sendPush(payload: { title: string; body: string; topic?: string; token?: string }) {
    // In production integrate with Firebase Admin SDK
    // For now just return the payload as "sent"
    return { sent: true, payload };
  }
}
