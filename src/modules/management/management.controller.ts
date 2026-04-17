import { Controller, Get, Post, Body, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ManagementService } from './management.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('management')
@UseGuards(JwtAuthGuard)
export class ManagementController {
  constructor(private readonly managementService: ManagementService) {}

  @Post('companies')
  createCompany(@Body() dto: any) {
    return this.managementService.createCompany(dto);
  }

  @Get('companies')
  getCompanies() {
    return this.managementService.getCompanies();
  }

  @Get('companies/:id')
  getCompany(@Param('id') id: string) {
    return this.managementService.getCompany(id);
  }

  @Post('assignments')
  createAssignment(@Body() dto: any) {
    return this.managementService.createAssignment(dto);
  }

  @Get('assignments')
  getAssignments(@Query('company_id') company_id?: string) {
    return this.managementService.getAssignments(company_id);
  }

  @Put('assignments/:id/permissions')
  updatePermissions(@Param('id') id: string, @Body() dto: any) {
    return this.managementService.updatePermissions(id, dto);
  }
}
