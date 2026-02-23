import { Controller, Post, Get, Param, Body, Put, Delete } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

@ApiTags('roles')
@Controller('roles')
@Auth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully.' })
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all roles' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edit role name/type' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateRoleDto>) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a role (fails if users assigned)' })
  async remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Assign permissions to a role' })
  async assignPermissions(@Param('id') id: string, @Body() dto: AssignPermissionsDto) {
    return this.rolesService.assignPermissions(id, dto);
  }
}
