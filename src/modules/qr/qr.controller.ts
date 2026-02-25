import { Controller, Post, Param, UseGuards, Get, Req, Res, NotFoundException, Patch, Query } from '@nestjs/common';
import { QrService } from './qr.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RoleName } from '../roles/entities/role.entity';
import { Auth } from '../../common/decorators/auth.decorator';
import type { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('qr')
@Controller()
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post('qr/generate/:unitId')
  @Auth()
  @Roles(RoleName.SUPER_ADMIN, RoleName.COMPANY_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Generate a QR token and return QR metadata (admin)' })
  async generate(@Param('unitId') unitId: string) {
    return this.qrService.createForUnit(unitId);
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
    // record scan and return minimal unit info placeholder
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const device = req.headers['user-agent'] as string | undefined;
    const result = await this.qrService.recordScan(token, device, ip);

    // TODO: load unit details from unit repository; for now return token metadata
    return {
      token: result.qr.token,
      unit_id: result.qr.unit_id,
      scan_count: result.qr.scan_count,
      expires_at: result.qr.expires_at,
    };
  }

  @Get('qr/analytics')
  @Auth()
  @Roles(RoleName.SUPER_ADMIN, RoleName.COMPANY_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin: QR analytics - top scanned QR codes' })
  @ApiQuery({ name: 'limit', required: false })
  async analytics(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 50;
    return this.qrService.analytics(l);
  }

  @Patch('qr/:id/deactivate')
  @Auth()
  @Roles(RoleName.SUPER_ADMIN, RoleName.COMPANY_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin: deactivate a QR code by id' })
  async deactivate(@Param('id') id: string) {
    return this.qrService.deactivate(id);
  }

  @Get('qr/export/pdf')
  @Auth()
  @Roles(RoleName.SUPER_ADMIN, RoleName.COMPANY_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Admin: export printable PDF sheets of QR codes' })
  async exportPdf(@Query('ids') idsQuery: string | undefined, @Res() res: Response) {
    const ids = idsQuery ? idsQuery.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
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
