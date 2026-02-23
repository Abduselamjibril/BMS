import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SitesService } from './sites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@ApiTags('Sites')
@Controller('sites')
@Auth()
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a site' })
  @ApiBody({ type: CreateSiteDto })
  @ApiResponse({ status: 201, description: 'Site created.' })
  async create(@Body() dto: CreateSiteDto) {
    return this.sitesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sites' })
  @ApiResponse({ status: 200, description: 'List of sites.' })
  async findAll() {
    return this.sitesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get site by id' })
  @ApiResponse({ status: 200, description: 'Site details.' })
  async findOne(@Param('id') id: string) {
    return this.sitesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a site' })
  @ApiResponse({ status: 200, description: 'Site updated.' })
  @ApiBody({
    description: 'Fields to update for the site (partial)',
    schema: {
      example: {
        name: 'Updated Site Name',
        city: 'Kigali',
        subcity: 'Nyarugenge',
        location_lat_long: ' -1.9579, 30.0619 '
      },
    },
  })
  async update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.sitesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a site' })
  @ApiResponse({ status: 200, description: 'Site deleted.' })
  async remove(@Param('id') id: string) {
    return this.sitesService.remove(id);
  }
}
