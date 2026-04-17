import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('drilldown')
  @ApiOperation({ summary: 'Revenue drilldown by building' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:revenue')
  async drilldown() {
    return this.reportsService.revenueDrilldown();
  }

  @Get('vacancy-trend')
  @ApiOperation({ summary: '12-month vacancy trend' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async vacancyTrend() {
    return this.reportsService.vacancyTrend();
  }

  @Get('overdue-aging')
  @ApiOperation({ summary: 'Overdue rent aging report' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async overdueAging() {
    return this.reportsService.overdueAging();
  }

  @Get('maintenance-analytics')
  @ApiOperation({ summary: 'Maintenance cost trends' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:maintenance')
  async maintenanceAnalytics() {
    return this.reportsService.maintenanceCostAnalytics();
  }

  @Get('turnover')
  @ApiOperation({ summary: 'Tenant turnover rate' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async turnover() {
    return this.reportsService.getTurnoverRate();
  }

  @Get('tenancy-duration')
  @ApiOperation({ summary: 'Average tenancy duration' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async tenancyDuration() {
    return this.reportsService.getAverageTenancy();
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Utility anomaly detection' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:utility')
  async anomalies() {
    return this.reportsService.getUtilityAnomalies();
  }

  @Get('people')
  @ApiOperation({ summary: 'Tenant and visitor report' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async peopleReport() {
    return this.reportsService.getPeopleReport();
  }

  @Get('leases')
  @ApiOperation({ summary: 'Detailed lease report' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async leaseReport() {
    return this.reportsService.getLeaseReport();
  }

  @Get('properties')
  @ApiOperation({ summary: 'Building-wise property report' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async propertyReport() {
    return this.reportsService.getPropertyReport();
  }

  @Get('overdue-details')
  @ApiOperation({ summary: 'Detailed delay fee and eviction report' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async overdueDetails() {
    return this.reportsService.getOverduePenaltyReport();
  }

  @Get('detailed-financials')
  @ApiOperation({ summary: 'Recent financial transactions report' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async detailedFinancials() {
    return this.reportsService.getDetailedFinancials();
  }

  @Get('finance-analytics')
  @ApiOperation({ summary: 'Advanced financial visual analytics' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async financeAnalytics() {
    return this.reportsService.getFinanceAnalytics();
  }

  @Get('property-analytics')
  @ApiOperation({ summary: 'Advanced property visual analytics' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async propertyAnalytics() {
    return this.reportsService.getPropertyAnalytics();
  }

  @Get('lease-analytics')
  @ApiOperation({ summary: 'Advanced lease visual analytics' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async leaseAnalytics() {
    return this.reportsService.getLeaseAnalytics();
  }

  @Get('people-analytics')
  @ApiOperation({ summary: 'Advanced people/visitor visual analytics' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async peopleAnalytics() {
    return this.reportsService.getPeopleAnalytics();
  }

  @Get('export')
  @ApiOperation({ summary: 'Export reports to CSV' })
  @Roles('super_admin', 'company_admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:dashboard')
  async export(@Query('type') type: string, @Res() res: Response) {
    const csv = await this.reportsService.generateCSV(type);
    res.header('Content-Type', 'text/csv');
    res.attachment(`${type}_report_${new Date().getTime()}.csv`);
    return res.send(csv);
  }
}
