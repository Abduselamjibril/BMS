import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';

@ApiTags('Settings')
@Controller('settings')
@Auth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings fetched.' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings updated.' })
  async updateSettings(@Body() dto: any) {
    return this.settingsService.updateSettings(dto);
  }
}
