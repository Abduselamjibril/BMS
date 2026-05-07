import { Controller, Get, Post, Body, Param, Delete, Query, Res, Req } from '@nestjs/common';
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
  async dashboard(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.dashboard(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('financial')
  @ApiOperation({ summary: 'Monthly revenue trends' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async financial(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.financialTrend(12, req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Occupancy insights and expiring leases' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async occupancy(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.occupancyInsights(req.user, buildingId, ownerId, siteId);
  }

  @Get('drilldown')
  @ApiOperation({ summary: 'Revenue drilldown by building' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:revenue')
  async drilldown(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.revenueDrilldown(req.user, buildingId, ownerId, siteId);
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
  async overdueAging(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.overdueAging(req.user, buildingId, ownerId, siteId);
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
  async peopleReport(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getPeopleReport(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('leases')
  @ApiOperation({ summary: 'Detailed lease report' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async leaseReport(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getLeaseReport(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('properties')
  @ApiOperation({ summary: 'Building-wise property report' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async propertyReport(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getPropertyReport(req.user, buildingId, ownerId, siteId);
  }

  @Get('overdue-details')
  @ApiOperation({ summary: 'Detailed delay fee and eviction report' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async overdueDetails(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getOverduePenaltyReport(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('detailed-financials')
  @ApiOperation({ summary: 'Recent financial transactions report' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async detailedFinancials(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getDetailedFinancials(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('finance-analytics')
  @ApiOperation({ summary: 'Advanced financial visual analytics' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async financeAnalytics(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getFinanceAnalytics(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('property-analytics')
  @ApiOperation({ summary: 'Advanced property visual analytics' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async propertyAnalytics(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getPropertyAnalytics(req.user, buildingId, ownerId, siteId);
  }

  @Get('lease-analytics')
  @ApiOperation({ summary: 'Advanced lease visual analytics' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async leaseAnalytics(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getLeaseAnalytics(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('people-analytics')
  @ApiOperation({ summary: 'Advanced people/visitor visual analytics' })
  @Roles('super_admin', 'admin', 'site_admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:occupancy')
  async peopleAnalytics(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getPeopleAnalytics(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('invoice-status-breakdown')
  @ApiOperation({ summary: 'Invoice status breakdown (Paid/Partial/Unpaid)' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async invoiceStatusBreakdown(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getInvoiceStatusBreakdown(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('collection-rate-trend')
  @ApiOperation({ summary: 'Monthly collection rate trend' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async collectionRateTrend(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getMonthlyCollectionRate(req.user, buildingId, startDate, endDate, ownerId, siteId);
  }

  @Get('tenant-payment-history')
  @ApiOperation({ summary: 'Full tenant payment history' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:financial')
  async tenantPaymentHistory(@Req() req: any, @Query('buildingId') buildingId?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('ownerId') ownerId?: string, @Query('siteId') siteId?: string) {
    return this.reportsService.getTenantPaymentHistory(req.user, buildingId, startDate, endDate, ownerId, siteId);
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

  @Get('export-pdf')
  @ApiOperation({ summary: 'Export reports to PDF' })
  @Roles('super_admin', 'admin', 'site_admin', 'finance', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:dashboard')
  async exportPdf(@Query('type') type: string, @Req() req: any, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generatePDF(type, {}, req.user);
    res.header('Content-Type', 'application/pdf');
    res.attachment(`${type}_report_${new Date().getTime()}.pdf`);
    return res.send(pdfBuffer);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'Get report schedules' })
  @Roles('super_admin', 'admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:dashboard')
  async getSchedules(@Req() req: any) {
    return this.reportsService.getSchedules(req.user);
  }

  @Post('schedules')
  @ApiOperation({ summary: 'Create report schedule' })
  @Roles('super_admin', 'admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:dashboard')
  async createSchedule(@Body() dto: any, @Req() req: any) {
    return this.reportsService.createSchedule(dto, req.user);
  }

  @Delete('schedules/:id')
  @ApiOperation({ summary: 'Delete report schedule' })
  @Roles('super_admin', 'admin', 'owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('reports:dashboard')
  async deleteSchedule(@Param('id') id: string, @Req() req: any) {
    return this.reportsService.deleteSchedule(id, req.user);
  }
}
