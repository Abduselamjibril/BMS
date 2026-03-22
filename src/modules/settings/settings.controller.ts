import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from '../../common/decorators/auth.decorator';

@ApiTags('Settings')
@Controller('settings')
@Auth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings:read')
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings fetched.' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @Permissions('settings:update')
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings updated.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string', example: 'Acme Corp' },
        tin_number: { type: 'string', example: '123456789' },
        vat_number: { type: 'string', example: '987654321' },
        logo: { type: 'string', format: 'binary' },
      },
      required: ['company_name', 'tin_number', 'vat_number'],
    },
  })
  @UseInterceptors(FileInterceptor('logo'))
  async updateSettings(
    @Body() dto: any,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.settingsService.updateSettings({ ...dto, logo }, logo);
  }
}
