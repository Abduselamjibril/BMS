import { Controller, Post, Body, Get, Query, Param, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VisitorsService } from './visitors.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('visitors')
@Controller('visitors')
@Auth()
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Post()
  @ApiOperation({ summary: 'Check-in a visitor (site-scoped)' })
  async create(@Body() dto: CreateVisitorDto) {
    return this.visitorsService.create(dto);
  }

  @Get()
  @Permissions('visitors:read')
  @ApiOperation({ summary: 'List visitors; optional site_id query' })
  async findAll(@Query('site_id') siteId?: string) {
    return this.visitorsService.findAll(siteId);
  }

  @Get(':id')
  @Permissions('visitors:read')
  async findOne(@Param('id') id: string) {
    return this.visitorsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('visitors:update')
  async update(@Param('id') id: string, @Body() dto: UpdateVisitorDto) {
    return this.visitorsService.update(id, dto);
  }

  @Patch(':id/checkout')
  @Permissions('visitors:checkout')
  async checkout(@Param('id') id: string) {
    return this.visitorsService.checkOut(id);
  }

  @Delete(':id')
  @Permissions('visitors:delete')
  async remove(@Param('id') id: string) {
    return this.visitorsService.remove(id);
  }
}
