import { Controller, Get, Post, Body, Param, Put, Delete, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Units')
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a unit (unit_number unique per building)' })
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Post('bulk-upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk upload units via CSV' })
  async bulkUpload(@UploadedFile() file: any) {
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
