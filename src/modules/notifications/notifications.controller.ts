import { 
  Controller, 
  Post, 
  Body, 
  Delete, 
  Param, 
  Get, 
  Patch, 
  Query 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokenService } from './device-token.service';
import { Auth } from '../../common/decorators/auth.decorator';

@ApiTags('notifications')
@Controller('notifications')
@Auth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly deviceTokenService: DeviceTokenService,
  ) {}

  // --- IN-APP NOTIFICATIONS MANAGEMENT ---

  @Get()
  @ApiOperation({ summary: 'Get all notifications for a user' })
  @ApiQuery({ name: 'user_id', required: true, type: String })
  async getNotifications(@Query('user_id') user_id: string) {
    return this.notificationsService.getNotifications(user_id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for user' })
  @ApiQuery({ name: 'user_id', required: true, type: String })
  async readAll(@Query('user_id') user_id: string) {
    return this.notificationsService.markAllAsRead(user_id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification by ID' })
  @ApiQuery({ name: 'user_id', required: true, type: String })
  async deleteNotification(
    @Param('id') id: string, 
    @Query('user_id') user_id: string
  ) {
    return this.notificationsService.deleteNotification(id, user_id);
  }

  // --- SUPER ADMIN / SYSTEM ANNOUNCEMENTS ---

  @Post('announce')
  @ApiOperation({ summary: 'Send announcement to all or specific group' })
  @ApiQuery({ name: 'super_admin_id', required: true, type: String })
  @ApiBody({ schema: { type: 'object', properties: { title: { type: 'string' }, message: { type: 'string' }, type: { type: 'string' }, targetUserIds: { type: 'array', items: { type: 'string' } } }, required: ['title', 'message'] } })
  async announce(
    @Body() body: { title: string; message: string; type?: string; targetUserIds?: string[] },
    @Query('super_admin_id') super_admin_id: string,
  ) {
    // If targetUserIds provided, send to those users; else send to all
    return this.notificationsService.announce(body, super_admin_id);
  }

  // --- DEVICE TOKEN MANAGEMENT (FCM) ---

  @Post('devices')
  @ApiOperation({ summary: 'Register or update FCM device token' })
  @ApiQuery({ name: 'user_id', required: true, type: String })
  @ApiBody({ schema: { type: 'object', properties: { fcm_token: { type: 'string' }, device_type: { type: 'string' } }, required: ['fcm_token', 'device_type'] } })
  async registerDevice(
    @Body() body: { fcm_token: string; device_type: string }, 
    @Query('user_id') user_id: string
  ) {
    return this.deviceTokenService.registerDevice(user_id, body.fcm_token, body.device_type);
  }

  @Delete('devices/:token')
  @ApiOperation({ summary: 'Unregister FCM device token' })
  @ApiParam({ name: 'token', required: true, type: String })
  async unregisterDevice(@Param('token') token: string) {
    return this.deviceTokenService.unregisterDevice(token);
  }

  // --- PUSH NOTIFICATION TESTING / SENDING ---

  @Post('test-push')
  @ApiOperation({ summary: 'Send test push notification to current user' })
  @ApiQuery({ name: 'user_id', required: true, type: String })
  @ApiBody({ schema: { type: 'object', properties: { title: { type: 'string' }, message: { type: 'string' } }, required: ['title', 'message'] } })
  async testPush(
    @Query('user_id') user_id: string, 
    @Body() body: { title: string; message: string }
  ) {
    const tokenList = await this.deviceTokenService.getTokensByUser(user_id);
    return this.pushNotificationService.sendPush(tokenList, body.title, body.message);
  }

  @Post('push')
  @ApiOperation({ summary: 'Send web-push notification (placeholder for FCM)' })
  @ApiBody({ schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, topic: { type: 'string' }, token: { type: 'string' } }, required: ['title', 'body'] } })
  async push(@Body() body: { title: string; body: string; topic?: string; token?: string }) {
    return this.notificationsService.sendPush(body);
  }
}