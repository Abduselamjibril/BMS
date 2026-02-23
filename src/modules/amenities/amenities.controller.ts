import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Amenities')
@Controller('amenities')
@Auth()
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

  @Get(':amenity_id')
  @ApiOperation({ summary: 'Get amenity by id' })
  findOne(@Param('amenity_id') amenityId: string) {
    return this.amenitiesService.findOne(amenityId);
  }

  @Put(':amenity_id')
  @ApiOperation({ summary: 'Update amenity by id' })
  @ApiBody({ schema: { properties: {
    name: { type: 'string', example: 'Swimming Pool' },
    description: { type: 'string', example: 'Olympic size pool' },
    category: { type: 'string', example: 'leisure' }
  } } })
  update(@Param('amenity_id') amenityId: string, @Body() dto: Partial<CreateAmenityDto>) {
    return this.amenitiesService.update(amenityId, dto);
  }

  @Delete(':amenity_id')
  @ApiOperation({ summary: 'Delete amenity by id' })
  remove(@Param('amenity_id') amenityId: string) {
    return this.amenitiesService.remove(amenityId);
  }

  // Link amenity to building
  @Post('/buildings/:building_id/amenities/:amenity_id')
  @ApiOperation({ summary: 'Link amenity to building' })
  linkToBuilding(@Param('building_id') buildingId: string, @Param('amenity_id') amenityId: string) {
    return this.amenitiesService.linkToBuilding(buildingId, amenityId);
  }

  @Delete('/buildings/:building_id/amenities/:amenity_id')
  @ApiOperation({ summary: 'Remove amenity from building' })
  unlinkFromBuilding(@Param('building_id') buildingId: string, @Param('amenity_id') amenityId: string) {
    return this.amenitiesService.unlinkFromBuilding(buildingId, amenityId);
  }

  // Link amenity to unit
  @Post('/units/:unit_id/amenities/:amenity_id')
  @ApiOperation({ summary: 'Link amenity to unit' })
  linkToUnit(@Param('unit_id') unitId: string, @Param('amenity_id') amenityId: string) {
    return this.amenitiesService.linkToUnit(unitId, amenityId);
  }

  @Delete('/units/:unit_id/amenities/:amenity_id')
  @ApiOperation({ summary: 'Remove amenity from unit' })
  unlinkFromUnit(@Param('unit_id') unitId: string, @Param('amenity_id') amenityId: string) {
    return this.amenitiesService.unlinkFromUnit(unitId, amenityId);
  }
}
