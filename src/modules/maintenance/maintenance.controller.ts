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
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';

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
  async getWorkOrders(@Req() req: any) {
    return this.maintenanceService.getWorkOrders(req.user);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get all maintenance requests' })
  @ApiResponse({ status: 200, description: 'Requests list.' })
  async getRequests(@Req() req: any) {
    return this.maintenanceService.getRequests(req.user);
  }

  // --- Maintenance Schedules ---
  @Post('schedules')
  @Permissions('maintenance:schedules:create')
  @ApiOperation({ summary: 'Create a maintenance schedule' })
  async createSchedule(@Body() dto: CreateMaintenanceScheduleDto) {
    return this.maintenanceService.createSchedule(dto);
  }

  @Get('schedules')
  @Permissions('maintenance:schedules:read')
  @ApiOperation({ summary: 'List maintenance schedules' })
  async getSchedules(@Query('building_id') building_id?: string, @Req() req?: any) {
    return this.maintenanceService.getSchedules(building_id, req?.user);
  }

  @Patch('schedules/:id')
  @Permissions('maintenance:schedules:update')
  @ApiOperation({ summary: 'Update a maintenance schedule' })
  async updateSchedule(@Param('id') id: string, @Body() dto: any) {
    return this.maintenanceService.updateSchedule(id, dto);
  }

  @Delete('schedules/:id')
  @Permissions('maintenance:schedules:delete')
  @ApiOperation({ summary: 'Delete a maintenance schedule' })
  async deleteSchedule(@Param('id') id: string, @Req() req: any) {
    return this.maintenanceService.deleteSchedule(id, req.user);
  }

  @Post('schedules/run-cron')
  @Permissions('maintenance:schedules:run_cron')
  @ApiOperation({ summary: 'Manually run the maintenance cron' })
  async runCron() {
    return this.maintenanceService.runMaintenanceCron();
  }

  @Post('sla/check')
  @Permissions('maintenance:sla:check')
  @ApiOperation({ summary: 'Manually trigger SLA breach check' })
  async checkSla() {
    return this.maintenanceService.runSlaCheckCron();
  }

  @Patch('requests/:id')
  @ApiOperation({ summary: 'Edit or cancel maintenance request' })
  @ApiResponse({ status: 200, description: 'Request updated.' })
  async updateRequest(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceRequestDto,
    @Req() req: any,
  ) {
    return this.maintenanceService.updateRequest(id, dto, req.user);
  }

  @Post('work-orders')
  @Permissions('maintenance:work_orders:create')
  @ApiOperation({
    summary: 'Convert request to work order and assign contractor',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Work order created.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', format: 'uuid', description: 'ID of the maintenance request' },
        contractor_id: { type: 'string', format: 'uuid', description: 'ID of the assigned contractor' },
        scheduled_date: { type: 'string', format: 'date-time', description: 'Scheduled date for the work order' },
        estimated_cost: { type: 'number', description: 'Estimated cost of the work' },
        description: { type: 'string', description: 'Description of the work order' },
        photo_reported: {
          type: 'string',
          format: 'binary',
          description: 'Photo reported by the contractor (file upload)',
        },
      },
      required: ['request_id', 'contractor_id', 'scheduled_date', 'estimated_cost'],
    },
  })
  @ApiQuery({
    name: 'assigned_by',
    required: true,
    description: 'User ID of the person assigning the work order (UUID)',
    example: 'f949849a-e94a-4130-8278-2825ac401e5c',
  })
  @UseInterceptors(
    FileInterceptor('photo_reported', {
      storage: diskStorage({
        destination: './uploads/maintenance',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async convertToWorkOrder(
    @Body() dto: any, // Use any because of multipart form
    @Query('assigned_by') assigned_by: string,
    @UploadedFile() photo_reported?: Express.Multer.File,
  ) {
    const photoUrl = photo_reported ? `/public/maintenance/${photo_reported.filename}` : undefined;
    return this.maintenanceService.convertToWorkOrder({ ...dto, assigned_by, photo_reported: photoUrl });
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
          type: 'string', // Changed to string for multipart form
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
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: diskStorage({
        destination: './uploads/maintenance',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async updateWorkOrderStatus(
    @Param('id') id: string,
    @Body('status') status: MaintenanceStatus,
    @Body('actual_cost') actual_cost?: string,
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    const photoUrl = proof ? `/public/maintenance/${proof.filename}` : undefined;
    return this.maintenanceService.updateWorkOrderStatus(
      id,
      status,
      actual_cost ? Number(actual_cost) : undefined,
      photoUrl,
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
  async getMaintenanceReport(@Req() req: any) {
    return this.maintenanceService.getDashboardKpis(undefined, req.user);
  }
}
