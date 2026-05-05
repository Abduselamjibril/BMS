import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Request,
} from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Buildings')
@Controller('buildings')
@Auth()
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a building' })
  @ApiBody({ type: CreateBuildingDto })
  @Permissions('buildings:create')
  create(@Body() dto: CreateBuildingDto) {
    return this.buildingsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all buildings' })
  @Permissions('buildings:read')
  findAll(@Request() req) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.buildingsService.findAll(userId, roles);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get building by id' })
  @Permissions('buildings:read')
  findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.buildingsService.findOne(id, userId, roles);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update building by id' })
  @ApiBody({ type: UpdateBuildingDto })
  @Permissions('buildings:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBuildingDto,
    @Request() req,
  ) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.buildingsService.update(id, dto, userId, roles);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete building by id' })
  @Permissions('buildings:delete')
  remove(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id;
    const roles = req.user?.roles || [];
    return this.buildingsService.remove(id, userId, roles);
  }

  @Get(':id/amenities')
  @ApiOperation({ summary: 'List amenities linked to building' })
  @Permissions('buildings:read')
  async getAmenities(@Param('id') buildingId: string) {
    return this.buildingsService.getAmenities(buildingId);
  }

  @Post(':buildingId/assign-admin/:userId')
  @ApiOperation({ summary: 'Assign nominee admin to building' })
  @Permissions('buildings:assign_admin')
  assignAdmin(
    @Param('buildingId') buildingId: string,
    @Param('userId') userId: string,
  ) {
    return this.buildingsService.assignAdmin(buildingId, userId);
  }

  @Get(':id/admins')
  @ApiOperation({ summary: 'List admins assigned to building' })
  @Permissions('buildings:read')
  getAdmins(@Param('id') buildingId: string) {
    return this.buildingsService.getAdmins(buildingId);
  }

  @Delete(':id/admins/:userId')
  @ApiOperation({ summary: 'Revoke admin access from building' })
  @Permissions('buildings:revoke_admin')
  revokeAdmin(
    @Param('id') buildingId: string,
    @Param('userId') userId: string,
  ) {
    return this.buildingsService.revokeAdmin(buildingId, userId);
  }
}
