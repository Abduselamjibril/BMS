import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Patch,
  Delete,
  Req,
} from '@nestjs/common';
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
  async create(@Body() dto: CreateVisitorDto, @Req() req: any) {
    return this.visitorsService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List visitors; optional site_id query' })
  async findAll(@Req() req: any, @Query('site_id') siteId?: string) {
    return this.visitorsService.findAll(req.user, siteId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.visitorsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Permissions('visitors:update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVisitorDto,
    @Req() req: any,
  ) {
    return this.visitorsService.update(id, dto, req.user);
  }

  @Patch(':id/checkout')
  @ApiOperation({ summary: 'Checkout a visitor' })
  async checkout(@Param('id') id: string, @Req() req: any) {
    return this.visitorsService.checkOut(id, req.user);
  }

  @Delete(':id')
  @Permissions('visitors:delete')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.visitorsService.remove(id, req.user);
  }
}
