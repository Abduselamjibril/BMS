import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { Lease } from '../leases/entities/lease.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { DocumentTemplateService } from './template.service';
import { diskStorage } from 'multer';
import { Auth } from '../../common/decorators/auth.decorator';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Documents')
@Controller('documents')
@Auth()
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly templateService: DocumentTemplateService,
  ) {}

  @Post('upload')
  @Permissions('documents:upload')
  @ApiOperation({ summary: 'Upload document (hybrid storage)' })
  @ApiResponse({ status: 201, description: 'Document uploaded.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file to upload',
        },
        module_type: {
          type: 'string',
          example: 'lease',
          description:
            'Module type (e.g., lease, tenant, maintenance, payment)',
        },
        module_id: {
          type: 'string',
          example: 'test-lease-id',
          description: 'Module ID (e.g., lease ID, tenant ID, etc.)',
        },
      },
      required: ['file', 'module_type', 'module_id'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + '-' + file.originalname);
        },
      }),
    }),
  )
  async uploadDocument(
    @Body() dto: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.documentService.uploadDocument(dto, file, req.user.id);
  }

  @Get('search')
  @Permissions('documents:search')
  @ApiOperation({ summary: 'Search documents by module_type, name, or date' })
  @ApiResponse({ status: 200, description: 'Documents list.' })
  @ApiQuery({
    name: 'module_type',
    required: false,
    description: 'Module type (lease, tenant, maintenance, payment)',
    example: 'lease',
  })
  @ApiQuery({
    name: 'module_id',
    required: false,
    description: 'Module ID (UUID or string)',
    example: 'c6ae50a4-1053-470e-afe4-73403c914cbc',
  })
  @ApiQuery({
    name: 'file_name',
    required: false,
    description: 'File name',
    example: 'file.pdf',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Upload date (YYYY-MM-DD)',
    example: '2026-02-25',
  })
  async searchDocuments(@Query() filters: any, @Req() req: any) {
    return this.documentService.searchDocuments(filters, req.user);
  }

  @Get(':id/history')
  @Permissions('documents:history')
  @ApiOperation({ summary: 'Get document version history' })
  @ApiResponse({ status: 200, description: 'Document history.' })
  async getDocumentHistory(@Param('id') id: string) {
    return this.documentService.getDocumentHistory(id);
  }

  @Delete(':id')
  @Permissions('documents:delete')
  @ApiOperation({ summary: 'Soft delete document' })
  @ApiResponse({ status: 200, description: 'Document deleted.' })
  async softDeleteDocument(@Param('id') id: string) {
    return this.documentService.softDeleteDocument(id);
  }

  @Post('generate-contract')
  @ApiOperation({ summary: 'Generate lease agreement from template' })
  @Permissions('documents:create')
  async generateContract(
    @Body() dto: { lease_id: string; template_id: string },
  ) {
    const template = await this.documentRepo.findOne({
      where: { id: dto.template_id, is_template: true },
    });
    if (!template || !template.template_content) {
      throw new NotFoundException('Template not found');
    }

    const lease = await this.leaseRepo.findOne({
      where: { id: dto.lease_id },
      relations: ['tenant', 'unit'],
    });
    if (!lease) throw new NotFoundException('Lease not found');

    const compiledContent = this.templateService.compile(
      template.template_content,
      { lease, tenant: lease.tenant },
    );

    const newDoc = this.documentRepo.create({
      file_name: `Lease_Agreement_${lease.tenant.last_name}.html`,
      mime_type: 'text/html',
      file_size: Buffer.byteLength(compiledContent),
      storage_path: `generated_contracts/lease_${lease.id}.html`,
      module_type: 'lease',
      module_id: lease.id,
      version: 1,
      category: 'CONTRACT',
      template_content: compiledContent,
    });

    return this.documentRepo.save(newDoc);
  }
}
