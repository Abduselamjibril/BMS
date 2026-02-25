import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Maintenance')
@Controller('maintenance')
@Auth()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Submit maintenance request' })
  @ApiResponse({ status: 201, description: 'Request submitted.' })
  async submitRequest(@Body() dto: any) {
    return this.maintenanceService.submitRequest(dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get maintenance requests (scoped)' })
  @ApiResponse({ status: 200, description: 'Requests list.' })
  async getRequests(@Query() query: any) {
    return this.maintenanceService.getRequests(query);
  }

  @Patch('requests/:id')
  @ApiOperation({ summary: 'Edit or cancel maintenance request' })
  @ApiResponse({ status: 200, description: 'Request updated.' })
  async updateRequest(@Param('id') id: string, @Body() dto: any) {
    return this.maintenanceService.updateRequest(id, dto);
  }

  @Post('work-orders')
  @ApiOperation({ summary: 'Convert request to work order and assign contractor' })
  @ApiResponse({ status: 201, description: 'Work order created.' })
  async convertToWorkOrder(@Body() dto: any) {
    return this.maintenanceService.convertToWorkOrder(dto);
  }

  @Patch('work-orders/:id')
  @ApiOperation({ summary: 'Update work order status (contractor only)' })
  @ApiResponse({ status: 200, description: 'Work order status updated.' })
  @UseInterceptors(FileInterceptor('proof'))
  async updateWorkOrderStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    return this.maintenanceService.updateWorkOrderStatus(id, status, proof?.path);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit feedback for completed work order' })
  @ApiResponse({ status: 201, description: 'Feedback submitted.' })
  async submitFeedback(@Body() dto: any) {
    // TODO: Implement feedback logic
    return { status: 'feedback received', dto };
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get maintenance KPIs and contractor performance' })
  @ApiResponse({ status: 200, description: 'Maintenance report.' })
  async getMaintenanceReport(@Query() query: any) {
    // TODO: Implement KPI logic
    return { status: 'report', query };
  }
}
