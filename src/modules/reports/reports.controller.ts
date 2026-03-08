import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// RoleName enum removed
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('reports')
@Controller('reports')
@Auth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Management dashboard KPIs' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:dashboard')
  async dashboard() {
    return this.reportsService.dashboard();
  }

  @Get('financial')
  @ApiOperation({ summary: 'Monthly revenue trends' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async financial() {
    return this.reportsService.financialTrend(12);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Occupancy insights and expiring leases' })
  @Roles('super_admin', 'company_admin', 'nominee_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async occupancy() {
    return this.reportsService.occupancyInsights();
  }
}
