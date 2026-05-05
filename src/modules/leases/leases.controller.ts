import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { LeasesService } from './leases.service';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { UploadLeaseDocDto } from './dto/upload-lease-doc.dto';
// upload lease DTO no longer used for multipart upload

@ApiTags('leases')
@Controller()
@Auth()
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) { }

  @Post('leases')
  @Permissions('leases:create')
  @ApiOperation({
    summary: 'Create lease draft with overlap and vacancy checks',
  })
  async create(@Body() dto: CreateLeaseDto, @Req() req: any) {
    return this.leasesService.create(dto, req.user.id, req.user.roles || []);
  }

  @Get('leases')
  @ApiOperation({
    summary: 'List leases with nominee building assignment scope',
  })
  @ApiQuery({ name: 'expiringSoon', required: false, type: Boolean })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'tenant_id', required: false, type: String })
  async findAll(
    @Req() req: any,
    @Query('expiringSoon', new ParseBoolPipe({ optional: true }))
    expiringSoon?: boolean,
    @Query('status') status?: string,
    @Query('tenant_id') tenant_id?: string,
  ) {
    return this.leasesService.findAll(req.user.id, expiringSoon, status, tenant_id);
  }

  @Get('leases/:id')
  @ApiOperation({ summary: 'Get lease details' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.leasesService.findOne(id, userId, roles);
  }

  @Get('leases/expiring-summary')
  @ApiOperation({ summary: 'Get summary of leases expiring in 30/60/90 days' })
  async getExpiringSummary() {
    return this.leasesService.getExpiringSummary();
  }

  @Patch('leases/:id/activate')
  @Permissions('leases:activate')
  @ApiOperation({
    summary:
      'Activate lease transaction (set active, unit occupied, create occupancy history, lock overlap)',
  })
  async activate(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.leasesService.activate(id, userId, roles);
  }

  @Get('leases/:id/payment-schedule')
  @ApiOperation({ summary: 'Get payment schedule for a specific lease' })
  async getPaymentSchedule(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.leasesService.getPaymentSchedule(id, userId, roles);
  }

  @Patch('leases/:id/terminate')
  @Permissions('leases:terminate')
  @ApiOperation({ summary: 'Terminate lease and release unit occupancy' })
  async terminate(@Param('id') id: string, @Body() dto: TerminateLeaseDto, @Req() req: any) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.leasesService.terminate(id, dto, userId, roles);
  }

  @Post('leases/:id/renew')
  @Permissions('leases:renew')
  @ApiOperation({ summary: 'Create renewed lease linked to previous lease' })
  async renew(@Param('id') id: string, @Body() dto: RenewLeaseDto, @Req() req: any) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.leasesService.renew(id, dto, userId, roles);
  }

  @Patch('leases/:id')
  @Permissions('leases:create')
  @ApiOperation({ summary: 'Update a draft lease (rent, dates, billing cycle, etc.)' })
  async update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.leasesService.update(id, dto, userId, roles);
  }

  @Delete('leases/:id')
  @Permissions('leases:terminate')
  @ApiOperation({ summary: 'Delete a draft lease' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.leasesService.remove(id, userId, roles);
  }

  @Post('leases/:id/upload')
  @ApiOperation({ summary: 'Attach signed lease document path' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadLeaseDocDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/leases',
        filename: (_req, file, cb) => {
          const uniqueName = `${Date.now()}-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!['application/pdf'].includes(file.mimetype)) {
          return cb(new Error('Only PDF allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadDoc(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const path = `/public/leases/${file.filename}`;
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.leasesService.uploadLeaseDocument(id, path, userId, roles);
  }

  @Get('leases/:id/download')
  @ApiOperation({ summary: 'Generate lease PDF from lease placeholders' })
  async download(@Param('id') id: string, @Res() res: Response, @Req() req: any) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    const buffer = await this.leasesService.downloadLeasePdf(id, userId, roles);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=lease-${id}.pdf`);
    res.send(buffer);
  }

  @Get('reports/occupancy')
  @ApiOperation({ summary: 'Get unit occupancy history report' })
  async occupancyReport() {
    return this.leasesService.occupancyReport();
  }
}
