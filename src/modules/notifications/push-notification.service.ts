import { Injectable } from '@nestjs/common';

@Injectable()
export class PushNotificationService {
  async sendPush(tokens: string[], title: string, body: string, data?: any) {
    if (!tokens.length) return;
    console.log('Stubbed Firebase Push:', title, body);
  }
}
