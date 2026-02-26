import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { diskStorage } from 'multer';
import { Auth } from '../../common/decorators/auth.decorator';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Documents')
@Controller('documents')
@Auth()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

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
          description: 'Module type (e.g., lease, tenant, maintenance, payment)',
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
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/documents',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
      },
    }),
  }))
  async uploadDocument(@Body() dto: any, @UploadedFile() file: Express.Multer.File) {
    return this.documentService.uploadDocument(dto, file);
  }

  @Get('search')
  @Permissions('documents:search')
  @ApiOperation({ summary: 'Search documents by module_type, name, or date' })
  @ApiResponse({ status: 200, description: 'Documents list.' })
  @ApiQuery({ name: 'module_type', required: false, description: 'Module type (lease, tenant, maintenance, payment)', example: 'lease' })
  @ApiQuery({ name: 'module_id', required: false, description: 'Module ID (UUID or string)', example: 'c6ae50a4-1053-470e-afe4-73403c914cbc' })
  @ApiQuery({ name: 'file_name', required: false, description: 'File name', example: 'file.pdf' })
  @ApiQuery({ name: 'date', required: false, description: 'Upload date (YYYY-MM-DD)', example: '2026-02-25' })
  async searchDocuments(@Query() filters: any) {
    return this.documentService.searchDocuments(filters);
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
}
