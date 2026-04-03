import {
  Controller,
  Post,
  Param,
  UseGuards,
  Get,
  Req,
  Res,
  NotFoundException,
  Patch,
  Query,
} from '@nestjs/common';
import { QrService } from './qr.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// RoleName enum removed
import { Auth } from '../../common/decorators/auth.decorator';
import type { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('qr')
@Controller()
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post('qr/generate/:unitId')
  @Auth()
  @Permissions('qr:generate')
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Generate a QR token and return QR metadata (admin)',
  })
  async generate(@Param('unitId') unitId: string) {
    return this.qrService.createForUnit(unitId);
  }

  @Post('qr/generate-building/:buildingId')
  @Auth()
  @Permissions('qr:generate')
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Generate a QR token for a building (admin)' })
  async generateForBuilding(@Param('buildingId') buildingId: string) {
    return this.qrService.createForBuilding(buildingId);
  }

  @Get('qr/:token/png')
  @ApiOperation({ summary: 'Return PNG buffer for QR code (admin/public)' })
  async png(@Param('token') token: string, @Res() res: Response) {
    try {
      const buffer = await this.qrService.generateQrPngBuffer(token);
      res.setHeader('Content-Type', 'image/png');
      res.send(buffer);
    } catch (err) {
      throw new NotFoundException(err.message);
    }
  }

  @Get('public/q/:token')
  @ApiOperation({ summary: 'Public: get unit info by QR token' })
  async publicLookup(@Param('token') token: string, @Req() req: Request) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const device = req.headers['user-agent'];
    const result = await this.qrService.recordScan(token, device, ip);

    return {
      token: result.qr.token,
      unit_id: result.qr.unit_id,
      building_id: (result.qr as any).building_id,
      scan_count: result.qr.scan_count,
      expires_at: result.qr.expires_at,
      unit: result.unit,
    };
  }

  @Get('public/building/:token/units')
  @ApiOperation({ summary: 'Public: get all units for a building QR token' })
  async publicBuildingUnits(@Param('token') token: string) {
    return this.qrService.getBuildingUnitsByToken(token);
  }

  @Get('qr/analytics')
  @Auth()
  @Permissions('qr:analytics')
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin: QR analytics - top scanned QR codes' })
  @ApiQuery({ name: 'limit', required: false })
  async analytics(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 50;
    return this.qrService.analytics(l);
  }

  @Get('qr/analytics/stats')
  @Auth()
  @Permissions('qr:analytics')
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin: Get 30-day time-series and device stats' })
  async getStats() {
    return this.qrService.getScanStats();
  }

  @Get('qr/analytics/logs')
  @Auth()
  @Permissions('qr:analytics')
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin: Get recent scan audit logs' })
  async getLogs(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 100;
    return this.qrService.getRecentLogs(l);
  }

  @Patch('qr/:id/deactivate')
  @Auth()
  @Permissions('qr:deactivate')
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin: deactivate a QR code by id' })
  async deactivate(@Param('id') id: string) {
    return this.qrService.deactivate(id);
  }

  @Get('qr/export/pdf')
  @Auth()
  @Permissions('qr:export_pdf')
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin: export printable PDF sheets of QR codes' })
  async exportPdf(
    @Query('ids') idsQuery: string | undefined,
    @Res() res: Response,
  ) {
    const ids = idsQuery
      ? idsQuery
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    try {
      const buffer = await this.qrService.exportPdf({ ids });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=qr-codes.pdf');
      res.send(buffer);
    } catch (err) {
      throw new NotFoundException(err.message);
    }
  }
}
