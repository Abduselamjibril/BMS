import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Buildings')
@Controller('buildings')
@Auth()
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a building (code must be unique, must link to site and owner)' })
  @ApiBody({ type: CreateBuildingDto })
  create(@Body() dto: CreateBuildingDto) {
    return this.buildingsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all buildings (nominee_admin sees only assigned)' })
  findAll(@Query('user_id') userId?: string, @Query('role') role?: string) {
    return this.buildingsService.findAll(userId, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get building by id' })
  findOne(@Param('id') id: string) {
    return this.buildingsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update building by id' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateBuildingDto>) {
    return this.buildingsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete building by id (fails if units exist)' })
  remove(@Param('id') id: string) {
    return this.buildingsService.remove(id);
  }

  // Building assignment engine
  @Post(':id/assign-admin')
  @ApiOperation({ summary: 'Assign nominee admin to building' })
  assignAdmin(@Param('id') buildingId: string, @Body() dto: { userId: string }) {
    return this.buildingsService.assignAdmin(buildingId, dto.userId);
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
