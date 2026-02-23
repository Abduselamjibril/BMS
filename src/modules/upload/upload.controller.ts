
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Delete,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  FileInterceptor,
  MulterModule,
} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UploadService } from './upload.service';
import { Auth } from '../../common/decorators/auth.decorator';


@ApiTags('Upload')
@Controller('upload')
@Auth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload a single image (JPEG/PNG, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/buildings',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
          return cb(new HttpException('Only JPEG/PNG allowed', HttpStatus.BAD_REQUEST), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    return { path: `/public/buildings/${file.filename}` };
  }

  @Post('document')
  @ApiOperation({ summary: 'Upload a single document (PDF/DOCX, max 10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/buildings',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)) {
          return cb(new HttpException('Only PDF/DOCX allowed', HttpStatus.BAD_REQUEST), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    return { path: `/public/buildings/${file.filename}` };
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Delete a file by filename' })
  @ApiParam({ name: 'filename', description: 'Name of the file to delete' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('filename') filename: string) {
    const deleted = await this.uploadService.deleteFile(filename);
    if (!deleted) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'File deleted' };
  }
}
