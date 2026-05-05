import { Controller, Get, Query, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
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
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:dashboard')
  async dashboard(@Req() req: any) {
    return this.reportsService.dashboard(req.user);
  }

  @Get('financial')
  @ApiOperation({ summary: 'Monthly revenue trends' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async financial(@Req() req: any) {
    return this.reportsService.financialTrend(12, req.user);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Occupancy insights and expiring leases' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async occupancy(@Req() req: any) {
    return this.reportsService.occupancyInsights(req.user);
  }

  @Get('drilldown')
  @ApiOperation({ summary: 'Revenue drilldown by building' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:revenue')
  async drilldown(@Req() req: any) {
    return this.reportsService.revenueDrilldown(req.user);
  }

  @Get('vacancy-trend')
  @ApiOperation({ summary: '12-month vacancy trend' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async vacancyTrend() {
    return this.reportsService.vacancyTrend();
  }

  @Get('overdue-aging')
  @ApiOperation({ summary: 'Overdue rent aging report' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async overdueAging(@Req() req: any) {
    return this.reportsService.overdueAging(req.user);
  }

  @Get('maintenance-analytics')
  @ApiOperation({ summary: 'Maintenance cost trends' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:maintenance')
  async maintenanceAnalytics() {
    return this.reportsService.maintenanceCostAnalytics();
  }

  @Get('turnover')
  @ApiOperation({ summary: 'Tenant turnover rate' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async turnover(@Req() req: any) {
    return this.reportsService.getTurnoverRate(); // Turnover is usually global, but I'll skip for now or add if needed
  }

  @Get('tenancy-duration')
  @ApiOperation({ summary: 'Average tenancy duration' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async tenancyDuration() {
    return this.reportsService.getAverageTenancy();
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Utility anomaly detection' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:utility')
  async anomalies() {
    return this.reportsService.getUtilityAnomalies();
  }

  @Get('people')
  @ApiOperation({ summary: 'Tenant and visitor report' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async peopleReport(@Req() req: any) {
    return this.reportsService.getPeopleReport(req.user);
  }

  @Get('leases')
  @ApiOperation({ summary: 'Detailed lease report' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async leaseReport(@Req() req: any) {
    return this.reportsService.getLeaseReport(req.user);
  }

  @Get('properties')
  @ApiOperation({ summary: 'Building-wise property report' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async propertyReport(@Req() req: any) {
    return this.reportsService.getPropertyReport(req.user);
  }

  @Get('overdue-details')
  @ApiOperation({ summary: 'Detailed delay fee and eviction report' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async overdueDetails(@Req() req: any) {
    return this.reportsService.getOverduePenaltyReport(req.user);
  }

  @Get('detailed-financials')
  @ApiOperation({ summary: 'Recent financial transactions report' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async detailedFinancials(@Req() req: any) {
    return this.reportsService.getDetailedFinancials(req.user);
  }

  @Get('finance-analytics')
  @ApiOperation({ summary: 'Advanced financial visual analytics' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async financeAnalytics(@Req() req: any) {
    return this.reportsService.getFinanceAnalytics(req.user);
  }

  @Get('property-analytics')
  @ApiOperation({ summary: 'Advanced property visual analytics' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async propertyAnalytics(@Req() req: any) {
    return this.reportsService.getPropertyAnalytics(req.user);
  }

  @Get('lease-analytics')
  @ApiOperation({ summary: 'Advanced lease visual analytics' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async leaseAnalytics(@Req() req: any) {
    return this.reportsService.getLeaseAnalytics(req.user);
  }

  @Get('people-analytics')
  @ApiOperation({ summary: 'Advanced people/visitor visual analytics' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async peopleAnalytics(@Req() req: any) {
    return this.reportsService.getPeopleAnalytics(req.user);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export reports to CSV' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:dashboard')
  async export(@Query('type') type: string, @Req() req: any, @Res() res: Response) {
    const csv = await this.reportsService.generateCSV(type, req.user);
    res.header('Content-Type', 'text/csv');
    res.attachment(`${type}_report_${new Date().getTime()}.csv`);
    return res.send(csv);
  }
}
