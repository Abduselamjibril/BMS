import { Controller, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';

@ApiTags('notifications')
@Controller('notifications')
@Auth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push')
  @ApiOperation({ summary: 'Send web-push notification (placeholder for FCM)' })
  async push(@Body() body: { title: string; body: string; topic?: string; token?: string }) {
    return this.notificationsService.sendPush(body);
  }
}
