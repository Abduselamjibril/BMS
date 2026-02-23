import { Controller, Get, Post, Body, Param, Put, Delete, Query, UploadedFile, UseInterceptors, HttpException, HttpStatus } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Units')
@Controller('units')
@Auth()
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a unit (unit_number unique per building)' })
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Post('bulk-upload')
  @ApiOperation({ summary: 'Bulk upload units via CSV' })
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
  @ApiResponse({ status: 201, description: 'CSV uploaded successfully.' })
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
        if (file.mimetype !== 'text/csv') {
          return cb(new HttpException('Only CSV files allowed', HttpStatus.BAD_REQUEST), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async bulkUpload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    // Optionally, pass the file path to the service for parsing
    return this.unitsService.bulkUpload(file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all units (filter by building_id, status)' })
  findAll(@Query('building_id') buildingId?: string, @Query('status') status?: string) {
    return this.unitsService.findAll(buildingId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit by id' })
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update unit by id' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateUnitDto>) {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete unit by id (fails if occupied)' })
  remove(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }

  // Amenity management
  @Post(':id/amenities')
  @ApiOperation({ summary: 'Link amenity to unit' })
  addAmenity(@Param('id') unitId: string, @Body() dto: { amenityId: string }) {
    return this.unitsService.addAmenity(unitId, dto.amenityId);
  }

  @Delete(':id/amenities/:a_id')
  @ApiOperation({ summary: 'Remove amenity from unit' })
  removeAmenity(@Param('id') unitId: string, @Param('a_id') amenityId: string) {
    return this.unitsService.removeAmenity(unitId, amenityId);
  }
}
