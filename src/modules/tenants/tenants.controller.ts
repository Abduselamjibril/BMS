import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantsService } from './tenants.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { CreateTenantApplicationDto } from './dto/create-tenant-application.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UploadTenantDocumentDto } from './dto/upload-tenant-document.dto';
import { TenantDocumentType } from './entities/tenant-document.entity';

@ApiTags('tenants')
@Controller()
@Auth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('tenants')
  @ApiOperation({ summary: 'List tenants' })
  async findAllTenants(@Req() req: any) {
    return this.tenantsService.findAllTenants(req.user.id);
  }

  @Post('tenants/register')
  @ApiOperation({ summary: 'Create User + Tenant profile' })
  async register(@Body() dto: RegisterTenantDto) {
    return this.tenantsService.register(dto);
  }

  @Patch('tenants/:id')
  @Permissions('tenants:update')
  @ApiOperation({ summary: 'Update a tenant profile' })
  async updateTenant(@Param('id') id: string, @Body() dto: any) {
    return this.tenantsService.updateTenant(id, dto);
  }

  @Post('applications')
  @ApiOperation({ summary: 'Create a tenant application' })
  async createApplication(@Body() dto: CreateTenantApplicationDto) {
    return this.tenantsService.createApplication(dto);
  }

  @Get('applications/pending')
  @Permissions('applications:review')
  @ApiOperation({ summary: 'List pending applications for admin review' })
  async pendingApplications() {
    return this.tenantsService.listPendingApplications();
  }

  @Patch('applications/:id/approve')
  @Permissions('applications:approve')
  @ApiOperation({
    summary: 'Approve tenant application and create draft lease',
  })
  async approveApplication(@Param('id') id: string) {
    return this.tenantsService.approveApplication(id);
  }

  @Patch('applications/:id/reject')
  @Permissions('applications:reject')
  @ApiOperation({ summary: 'Reject tenant application' })
  async rejectApplication(@Param('id') id: string) {
    return this.tenantsService.rejectApplication(id);
  }

  @Patch('documents/:id/verify')
  @Permissions('documents:verify')
  @ApiOperation({ summary: 'Verify or reject tenant document' })
  async verifyDocument(
    @Param('id') id: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.tenantsService.verifyDocument(id, dto);
  }

  @Post('documents')
  @ApiOperation({ summary: 'Create tenant document record' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadTenantDocumentDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/tenant-documents',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
        ];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new HttpException(
              'Only PDF/DOCX/JPEG/PNG allowed',
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async createTenantDocument(
    @Body() dto: UploadTenantDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    const fileUrl = `/public/tenant-documents/${file.filename}`;
    return this.tenantsService.createTenantDocument(
      {
        tenant_id: dto.tenant_id,
        type: dto.type as TenantDocumentType,
        file_url: fileUrl,
      },
      req.user,
    );
  }

  @Get('documents')
  @ApiOperation({
    summary: 'List tenant documents (optional filter: tenant_id)',
  })
  @ApiQuery({ name: 'tenant_id', required: false, type: String })
  async listTenantDocuments(
    @Req() req: any,
    @Query('tenant_id') tenantId?: string,
  ) {
    return this.tenantsService.listTenantDocuments(tenantId, req.user);
  }

  @Post('announcements')
  @Permissions('announcements:create')
  @ApiOperation({ summary: 'Create announcement for all/building/site' })
  async createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @Req() req: any,
  ) {
    return this.tenantsService.createAnnouncement(dto, req.user.id);
  }

  @Get('announcements')
  @ApiOperation({
    summary: 'List announcements (optional filters: site_id, building_id)',
  })
  @ApiQuery({ name: 'site_id', required: false, type: String })
  @ApiQuery({ name: 'building_id', required: false, type: String })
  async getAnnouncements(
    @Query('site_id') siteId?: string,
    @Query('building_id') buildingId?: string,
  ) {
    return this.tenantsService.findAnnouncements(siteId, buildingId);
  }

  @Post('messages')
  @Permissions('messages:send')
  @ApiOperation({ summary: 'Send direct message to tenant' })
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    return this.tenantsService.sendMessage(dto, req.user.id);
  }

  @Get('messages/:tenantId')
  @ApiOperation({
    summary: 'Get manager-tenant chat history and update read status',
  })
  async getMessages(@Param('tenantId') tenantId: string, @Req() req: any) {
    return this.tenantsService.getChatHistory(tenantId, req.user.id);
  }
}
