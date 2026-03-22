import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceStatus } from './entities/maintenance-request.entity';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

@ApiTags('Maintenance')
@Controller('maintenance')
@Auth()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Submit maintenance request' })
  @ApiResponse({ status: 201, description: 'Request submitted.' })
  async submitRequest(
    @Body() dto: CreateMaintenanceRequestDto,
    @Req() req: any,
  ) {
    return this.maintenanceService.submitRequest(dto, req.user.id);
  }

  @Get('contractors')
  @ApiOperation({ summary: 'List all contractors' })
  @ApiResponse({ status: 200, description: 'Contractors list.' })
  async getContractors() {
    return this.maintenanceService.getContractors();
  }

  @Post('contractors')
  @Permissions('maintenance:contractors:create')
  @ApiOperation({ summary: 'Create a contractor' })
  @ApiResponse({ status: 201, description: 'Contractor created.' })
  async createContractor(@Body() dto: CreateContractorDto) {
    return this.maintenanceService.createContractor(dto);
  }

  @Patch('contractors/:id')
  @ApiOperation({ summary: 'Update contractor details' })
  @ApiResponse({ status: 200, description: 'Contractor updated.' })
  async updateContractor(@Param('id') id: string, @Body() dto: any) {
    return this.maintenanceService.updateContractor(id, dto);
  }

  @Get('work-orders')
  @ApiOperation({ summary: 'List all work orders with relations' })
  @ApiResponse({ status: 200, description: 'Work orders list.' })
  async getWorkOrders() {
    return this.maintenanceService.getWorkOrders();
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get maintenance requests (scoped)' })
  @ApiResponse({ status: 200, description: 'Requests list.' })
  async getRequests(@Req() req: any) {
    return this.maintenanceService.getRequests(req.user);
  }

  @Patch('requests/:id')
  @ApiOperation({ summary: 'Edit or cancel maintenance request' })
  @ApiResponse({ status: 200, description: 'Request updated.' })
  async updateRequest(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceRequestDto,
  ) {
    return this.maintenanceService.updateRequest(id, dto);
  }

  @Post('work-orders')
  @Permissions('maintenance:work_orders:create')
  @ApiOperation({
    summary: 'Convert request to work order and assign contractor',
  })
  @ApiResponse({ status: 201, description: 'Work order created.' })
  @ApiQuery({
    name: 'assigned_by',
    required: true,
    description: 'User ID of the person assigning the work order (UUID)',
    example: 'f949849a-e94a-4130-8278-2825ac401e5c',
  })
  async convertToWorkOrder(
    @Body() dto: CreateWorkOrderDto,
    @Query('assigned_by') assigned_by: string,
  ) {
    return this.maintenanceService.convertToWorkOrder({ ...dto, assigned_by });
  }

  @Patch('work-orders/:id')
  @Permissions('maintenance:work_orders:update')
  @ApiOperation({ summary: 'Update work order status (contractor only)' })
  @ApiResponse({ status: 200, description: 'Work order status updated.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['in_progress', 'completed'],
          example: 'completed',
        },
        actual_cost: {
          type: 'number',
          description: 'Actual cost of the work (optional)',
        },
        proof: {
          type: 'string',
          format: 'binary',
          description: 'Proof of completion (file upload)',
        },
      },
      required: ['status'],
      example: {
        status: 'completed',
        actual_cost: 1500,
      },
    },
  })
  @UseInterceptors(FileInterceptor('proof'))
  async updateWorkOrderStatus(
    @Param('id') id: string,
    @Body('status') status: MaintenanceStatus,
    @Body('actual_cost') actual_cost?: number,
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    return this.maintenanceService.updateWorkOrderStatus(
      id,
      status,
      actual_cost,
      proof,
    );
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit feedback for completed work order' })
  @ApiResponse({ status: 201, description: 'Feedback submitted.' })
  async submitFeedback(@Body() dto: SubmitFeedbackDto) {
    return this.maintenanceService.submitFeedback(dto);
  }

  @Get('reports')
  @Permissions('maintenance:reports:read')
  @ApiOperation({ summary: 'Get maintenance KPIs and contractor performance' })
  @ApiResponse({ status: 200, description: 'Maintenance report.' })
  async getMaintenanceReport(@Query() query: any) {
    return this.maintenanceService.getDashboardKpis();
  }
}
