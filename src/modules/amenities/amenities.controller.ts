import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  Req,
  Request,
} from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
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
  @Permissions('amenities:create')
  create(@Body() dto: CreateAmenityDto) {
    return this.amenitiesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all amenities' })
  @Permissions('amenities:read')
  findAll(@Query() query?: any) {
    return this.amenitiesService.findAll(query);
  }

  @Get(':amenity_id')
  @ApiOperation({ summary: 'Get amenity by id' })
  @Permissions('amenities:read')
  findOne(@Param('amenity_id') amenityId: string) {
    return this.amenitiesService.findOne(amenityId);
  }



  @Put(':amenity_id')
  @ApiOperation({ summary: 'Update amenity by id' })
  @ApiBody({
    schema: {
      properties: {
        name: { type: 'string', example: 'Swimming Pool' },
        description: { type: 'string', example: 'Olympic size pool' },
        category: { type: 'string', example: 'leisure' },
      },
    },
  })
  @Permissions('amenities:update')
  update(
    @Param('amenity_id') amenityId: string,
    @Body() dto: Partial<CreateAmenityDto>,
  ) {
    return this.amenitiesService.update(amenityId, dto);
  }

  @Delete(':amenity_id')
  @ApiOperation({ summary: 'Delete amenity by id' })
  @Permissions('amenities:delete')
  remove(@Param('amenity_id') amenityId: string) {
    return this.amenitiesService.remove(amenityId);
  }

  // Link amenity to building
  @Post('/buildings/:building_id/amenities/:amenity_id')
  @ApiOperation({ summary: 'Link amenity to building' })
  @Permissions('amenities:link_building')
  linkToBuilding(
    @Param('building_id') buildingId: string,
    @Param('amenity_id') amenityId: string,
    @Request() req: any,
  ) {
    return this.amenitiesService.linkToBuilding(buildingId, amenityId, req.user);
  }

  @Delete('/buildings/:building_id/amenities/:amenity_id')
  @ApiOperation({ summary: 'Remove amenity from building' })
  @Permissions('amenities:remove_building')
  unlinkFromBuilding(
    @Param('building_id') buildingId: string,
    @Param('amenity_id') amenityId: string,
    @Request() req: any,
  ) {
    return this.amenitiesService.unlinkFromBuilding(buildingId, amenityId, req.user);
  }

  // Link amenity to unit
  @Post('/units/:unit_id/amenities/:amenity_id')
  @ApiOperation({ summary: 'Link amenity to unit' })
  @Permissions('amenities:link_unit')
  linkToUnit(
    @Param('unit_id') unitId: string,
    @Param('amenity_id') amenityId: string,
    @Request() req: any,
  ) {
    return this.amenitiesService.linkToUnit(unitId, amenityId, req.user);
  }

  @Delete('/units/:unit_id/amenities/:amenity_id')
  @ApiOperation({ summary: 'Remove amenity from unit' })
  @Permissions('amenities:remove_unit')
  unlinkFromUnit(
    @Param('unit_id') unitId: string,
    @Param('amenity_id') amenityId: string,
    @Request() req: any,
  ) {
    return this.amenitiesService.unlinkFromUnit(unitId, amenityId, req.user);
  }
}
