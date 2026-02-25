import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Documents')
@Controller('documents')
@Auth()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload document (hybrid storage)' })
  @ApiResponse({ status: 201, description: 'Document uploaded.' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@Body() dto: any, @UploadedFile() file: Express.Multer.File) {
    return this.documentService.uploadDocument(dto, file);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search documents by module_type, name, or date' })
  @ApiResponse({ status: 200, description: 'Documents list.' })
  async searchDocuments(@Query() filters: any) {
    return this.documentService.searchDocuments(filters);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get document version history' })
  @ApiResponse({ status: 200, description: 'Document history.' })
  async getDocumentHistory(@Param('id') id: string) {
    return this.documentService.getDocumentHistory(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete document' })
  @ApiResponse({ status: 200, description: 'Document deleted.' })
  async softDeleteDocument(@Param('id') id: string) {
    return this.documentService.softDeleteDocument(id);
  }
}
