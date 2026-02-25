import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RoleName } from '../roles/entities/role.entity';

@ApiTags('reports')
@Controller('reports')
@Auth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Management dashboard KPIs' })
  @Roles(RoleName.SUPER_ADMIN, RoleName.COMPANY_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async dashboard() {
    return this.reportsService.dashboard();
  }

  @Get('financial')
  @ApiOperation({ summary: 'Monthly revenue trends' })
  @Roles(RoleName.SUPER_ADMIN, RoleName.COMPANY_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async financial() {
    return this.reportsService.financialTrend(12);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Occupancy insights and expiring leases' })
  @Roles(RoleName.SUPER_ADMIN, RoleName.COMPANY_ADMIN, RoleName.NOMINEE_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async occupancy() {
    return this.reportsService.occupancyInsights();
  }
}
