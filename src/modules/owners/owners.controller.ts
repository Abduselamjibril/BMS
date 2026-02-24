import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { OwnersService } from './owners.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('Owners')
@Controller('owners')
@Auth()
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an owner' })
  create(@Body() dto: CreateOwnerDto) {
    return this.ownersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all owners' })
  findAll() {
    return this.ownersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get owner by id' })
  findOne(@Param('id') id: string) {
    return this.ownersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update owner by id' })
  @ApiBody({
    schema: {
      example: {
        name: 'Updated Owner Name',
        email: 'owner@example.com',
        phone: '+1234567890'
      }
    },
    type: CreateOwnerDto
  })
  update(@Param('id') id: string, @Body() dto: Partial<CreateOwnerDto>) {
    return this.ownersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete owner by id (fails if owner has buildings)' })
  @ApiResponse({ status: 200, description: 'Owner deleted successfully.' })
  remove(@Param('id') id: string) {
    return this.ownersService.remove(id);
  }
}
