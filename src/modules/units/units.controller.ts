import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Units')
@Controller('units')
@Auth()
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a unit' })
  @Permissions('units:create')
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Post('bulk-upload')
  @ApiOperation({ summary: 'Bulk upload units via CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/buildings',
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${uuidv4()}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async bulkUpload(@UploadedFile() file: Express.Multer.File) {
    if (!file)
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    return this.unitsService.bulkUpload(file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all units' })
  @ApiQuery({ name: 'building_id', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @Permissions('units:read')
  findAll(
    @Query('building_id') buildingId?: string,
    @Query('status') status?: string,
  ) {
    return this.unitsService.findAll(buildingId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit by id' })
  @Permissions('units:read')
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Get(':id/amenities')
  @ApiOperation({ summary: 'List amenities linked to unit' })
  @Permissions('units:read')
  async getAmenities(@Param('id') unitId: string) {
    return this.unitsService.getAmenities(unitId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update unit by id' })
  @ApiBody({
    schema: {
      example: {
        unit_number: '101',
        type: '1BR',
        floor: 1,
        size_sqm: 80,
        status: 'vacant',
        bedrooms: 1,
        bathrooms: 1,
        buildingId: 'a097e608-8df2-4716-85af-61df209ef5fc',
      },
    },
    type: require('./dto/create-unit.dto').CreateUnitDto,
  })
  @Permissions('units:update')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<import('./dto/create-unit.dto').CreateUnitDto>,
  ) {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete unit by id' })
  @Permissions('units:delete')
  remove(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }

  @Post(':id/amenities')
  @ApiOperation({ summary: 'Link amenity to unit' })
  @Permissions('units:amenities_link')
  addAmenity(@Param('id') unitId: string, @Body() dto: { amenityId: string }) {
    return this.unitsService.addAmenity(unitId, dto.amenityId);
  }

  @Delete(':id/amenities/:a_id')
  @ApiOperation({ summary: 'Remove amenity from unit' })
  @Permissions('units:amenities_remove')
  removeAmenity(@Param('id') unitId: string, @Param('a_id') amenityId: string) {
    return this.unitsService.removeAmenity(unitId, amenityId);
  }
}
