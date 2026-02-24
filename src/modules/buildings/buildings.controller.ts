import { Controller, Get, Post, Body, Param, Put, Delete, Request } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Buildings')
@Controller('buildings')
@Auth()
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a building' })
  @ApiBody({ type: CreateBuildingDto })
  create(@Body() dto: CreateBuildingDto) {
    return this.buildingsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all buildings' })
  findAll(@Request() req) {
    const userId = req.user?.id;
    const role = req.user?.role || null;
    return this.buildingsService.findAll(userId, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get building by id' })
  findOne(@Param('id') id: string) {
    return this.buildingsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update building by id' })
  @ApiBody({
    schema: {
      example: {
        name: 'Updated Building Name',
        code: 'BLD-001',
        type: 'residential',
        country: 'Ethiopia',
        city: 'Addis Ababa',
        subcity: 'Bole',
        address: '123 Main St',
        latitude: 9.03,
        longitude: 38.74,
        total_units: 10,
        status: 'active',
        siteId: 'site-uuid',
        ownerId: 'owner-uuid'
      }
    },
    type: require('./dto/create-building.dto').CreateBuildingDto
  })
  update(@Param('id') id: string, @Body() dto: Partial<import('./dto/create-building.dto').CreateBuildingDto>) {
    return this.buildingsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete building by id' })
  remove(@Param('id') id: string) {
    return this.buildingsService.remove(id);
  }

  @Get(':id/amenities')
  @ApiOperation({ summary: 'List amenities linked to building' })
  async getAmenities(@Param('id') buildingId: string) {
    return this.buildingsService.getAmenities(buildingId);
  }

  @Post(':buildingId/assign-admin/:userId')
  @ApiOperation({ summary: 'Assign nominee admin to building' })
  assignAdmin(@Param('buildingId') buildingId: string, @Param('userId') userId: string) {
    return this.buildingsService.assignAdmin(buildingId, userId);
  }

  @Get(':id/admins')
  @ApiOperation({ summary: 'List admins assigned to building' })
  getAdmins(@Param('id') buildingId: string) {
    return this.buildingsService.getAdmins(buildingId);
  }

  @Delete(':id/admins/:userId')
  @ApiOperation({ summary: 'Revoke admin access from building' })
  revokeAdmin(@Param('id') buildingId: string, @Param('userId') userId: string) {
    return this.buildingsService.revokeAdmin(buildingId, userId);
  }
}