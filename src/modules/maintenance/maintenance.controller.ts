import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Maintenance')
@Controller('maintenance')
@Auth()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Submit maintenance request' })
  @ApiResponse({ status: 201, description: 'Request submitted.' })
  @ApiQuery({ name: 'tenant_id', required: true, description: 'Tenant ID (UUID)', example: '6dee1135-ecd7-4abb-a899-54d48465d53f' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        unit_id: { type: 'string', example: 'unit-uuid' },
        description: { type: 'string', example: 'Leaking faucet in kitchen' },
        priority: { type: 'string', example: 'high' },
        category: { type: 'string', example: 'plumbing' }
      },
      required: ['unit_id', 'description', 'priority', 'category'],
      example: {
        unit_id: 'unit-uuid',
        description: 'Leaking faucet in kitchen',
        priority: 'high',
        category: 'plumbing'
      }
    }
  })
  async submitRequest(@Body() dto: any, @Query('tenant_id') tenant_id: string) {
    // Use tenant_id from query parameter
    return this.maintenanceService.submitRequest({ ...dto, tenantId: tenant_id });
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: { type: 'string', example: 'Updated description' },
        priority: { type: 'string', example: 'medium' },
        status: { type: 'string', example: 'cancelled' }
      },
      example: {
        description: 'Updated description',
        priority: 'medium',
        status: 'cancelled'
      }
    }
  })
  async updateRequest(@Param('id') id: string, @Body() dto: any) {
    return this.maintenanceService.updateRequest(id, dto);
  }

  @Post('work-orders')
  @ApiOperation({ summary: 'Convert request to work order and assign contractor' })
  @ApiResponse({ status: 201, description: 'Work order created.' })
  @ApiQuery({ name: 'assigned_by', required: true, description: 'User ID of the person assigning the work order (UUID)', example: 'f949849a-e94a-4130-8278-2825ac401e5c' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', example: 'request-uuid' },
        contractor_id: { type: 'string', example: 'contractor-uuid' },
        scheduled_date: { type: 'string', format: 'date', example: '2026-03-01' }
      },
      required: ['request_id', 'contractor_id', 'scheduled_date'],
      example: {
        request_id: 'request-uuid',
        contractor_id: 'contractor-uuid',
        scheduled_date: '2026-03-01'
      }
    }
  })
  async convertToWorkOrder(@Body() dto: any, @Query('assigned_by') assigned_by: string) {
    return this.maintenanceService.convertToWorkOrder({ ...dto, assigned_by });
  }

  @Patch('work-orders/:id')
  @ApiOperation({ summary: 'Update work order status (contractor only)' })
  @ApiResponse({ status: 200, description: 'Work order status updated.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'completed' },
        proof: { type: 'string', format: 'binary', description: 'Proof of completion (file upload)' }
      },
      required: ['status'],
      example: {
        status: 'completed'
      }
    }
  })
  @UseInterceptors(FileInterceptor('proof'))
  async updateWorkOrderStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    return this.maintenanceService.updateWorkOrderStatus(id, status, proof);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit feedback for completed work order' })
  @ApiResponse({ status: 201, description: 'Feedback submitted.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        work_order_id: { type: 'string', example: 'workorder-uuid' },
        rating: { type: 'number', example: 5 },
        comments: { type: 'string', example: 'Great job, quick fix!' }
      },
      required: ['work_order_id', 'rating'],
      example: {
        work_order_id: 'workorder-uuid',
        rating: 5,
        comments: 'Great job, quick fix!'
      }
    }
  })
  async submitFeedback(@Body() dto: any) {
    // TODO: Implement feedback logic
    return { status: 'feedback received', dto };
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get maintenance KPIs and contractor performance' })
  @ApiResponse({ status: 200, description: 'Maintenance report.' })
  async getMaintenanceReport(@Query() query: any) {
    return this.maintenanceService.getDashboardKpis();
  }
}
