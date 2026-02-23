import { Controller, Post, Get, Body, Delete, Param } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';

@ApiTags('permissions')
@Controller('permissions')
@Auth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({ status: 201, description: 'Permission created successfully.' })
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all permissions' })
  async findAll() {
    return this.permissionsService.findAll();
  }
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a permission' })
  async remove(@Param('id') id: string) {
    return this.permissionsService.remove(id);
  }
}
