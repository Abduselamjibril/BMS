import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Amenities')
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create an amenity' })
  create(@Body() dto: CreateAmenityDto) {
    return this.amenitiesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all amenities' })
  findAll() {
    return this.amenitiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get amenity by id' })
  findOne(@Param('id') id: string) {
    return this.amenitiesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update amenity by id' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateAmenityDto>) {
    return this.amenitiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete amenity by id' })
  remove(@Param('id') id: string) {
    return this.amenitiesService.remove(id);
  }

  // Link amenity to building
  @Post('/buildings/:id/amenities')
  @ApiOperation({ summary: 'Link amenity to building' })
  linkToBuilding(@Param('id') buildingId: string, @Body() dto: { amenityId: string }) {
    return this.amenitiesService.linkToBuilding(buildingId, dto.amenityId);
  }

  @Delete('/buildings/:id/amenities/:a_id')
  @ApiOperation({ summary: 'Remove amenity from building' })
  unlinkFromBuilding(@Param('id') buildingId: string, @Param('a_id') amenityId: string) {
    return this.amenitiesService.unlinkFromBuilding(buildingId, amenityId);
  }

  // Link amenity to unit
  @Post('/units/:id/amenities')
  @ApiOperation({ summary: 'Link amenity to unit' })
  linkToUnit(@Param('id') unitId: string, @Body() dto: { amenityId: string }) {
    return this.amenitiesService.linkToUnit(unitId, dto.amenityId);
  }

  @Delete('/units/:id/amenities/:a_id')
  @ApiOperation({ summary: 'Remove amenity from unit' })
  unlinkFromUnit(@Param('id') unitId: string, @Param('a_id') amenityId: string) {
    return this.amenitiesService.unlinkFromUnit(unitId, amenityId);
  }
}
