import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MaintenanceRequest,
  MaintenanceStatus,
} from './entities/maintenance-request.entity';
import {
  WorkOrder,
  Contractor,
} from './entities/contractor-and-workorder.entity';
import { MaintenanceFeedback } from './entities/maintenance-feedback.entity';
import { MaintenanceSchedule } from './entities/maintenance-schedule.entity';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import { UserBuilding } from '../users/entities/user-building.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Expense } from '../finance/entities/expense.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceRequest)
    private readonly requestRepo: Repository<MaintenanceRequest>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepo: Repository<WorkOrder>,
    @InjectRepository(Contractor)
    private readonly contractorRepo: Repository<Contractor>,
    @InjectRepository(MaintenanceFeedback)
    private readonly feedbackRepo: Repository<MaintenanceFeedback>,
    @InjectRepository(UserBuilding)
    private readonly userBuildingRepo: Repository<UserBuilding>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(MaintenanceSchedule)
    private readonly scheduleRepo: Repository<MaintenanceSchedule>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getSlaAcknowledgmentHours(priority: string): number {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 2;
      case 'high': return 4;
      case 'medium': return 8;
      case 'low': return 24;
      default: return 8;
    }
  }

  private getSlaResolutionHours(priority: string): number {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 24;
      case 'high': return 48;
      case 'medium': return 72;
      case 'low': return 120;
      default: return 72;
    }
  }

  async submitRequest(dto: any, authorId?: string) {
    let targetTenantId = dto.tenant_id;

    if (authorId) {
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: authorId } },
        relations: ['role'],
      });
      const isTenant = userRoles.some((ur) => ur.role.name === 'tenant');
      if (isTenant) {
        const tenant = await this.tenantRepo.findOne({
          where: { user: { id: authorId } },
        });
        if (tenant) targetTenantId = tenant.id;
      }
    }

    const request = this.requestRepo.create({
      ...dto,
      tenant: { id: targetTenantId },
      unit: dto.unit_id ? { id: dto.unit_id } : undefined,
      status: MaintenanceStatus.SUBMITTED,
    }) as unknown as MaintenanceRequest;

    // Calculate SLA Deadline (Acknowledgment)
    const hours = this.getSlaAcknowledgmentHours(dto.priority);
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + hours);
    request.sla_deadline = deadline;

    return this.requestRepo.save(request);
  }

  async getRequests(authenticatedUser: any) {
    const currentUserId = authenticatedUser.id || authenticatedUser.sub;

    // Scoped access: look up roles from DB for security
    const userRoles = await this.userRoleRepo.find({
      where: { user: { id: currentUserId } },
      relations: ['role'],
    });
    const roleNames = userRoles.map((ur) => ur.role.name);
    const isAdmin = roleNames.some(r => ['super_admin', 'admin'].includes(r));
    const isContractor = roleNames.includes('contractor');

    // Admin or Contractor see all requests (to enable assigning/viewing)
    if (isAdmin || isContractor) {
      return this.requestRepo.find({ relations: ['tenant', 'tenant.user', 'unit', 'workOrders', 'workOrders.contractor', 'feedbacks'] });
    }

    if (roleNames.includes('nominee_admin')) {
      const assignments = await this.userBuildingRepo.find({
        where: { user: { id: currentUserId } },
        relations: ['building'],
      });
      if (!assignments.length) return [];
      const buildingIds = assignments.map((a) => a.building.id);
      return this.requestRepo
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.tenant', 'tenant')
        .leftJoinAndSelect('tenant.user', 'user')
        .leftJoinAndSelect('request.unit', 'unit')
        .leftJoinAndSelect('request.workOrders', 'workOrders')
        .leftJoinAndSelect('workOrders.contractor', 'contractor')
        .leftJoinAndSelect('request.feedbacks', 'feedbacks')
        .where('unit.building_id IN (:...buildingIds)', { buildingIds })
        .getMany();
    }

    if (roleNames.includes('tenant')) {
      const tenant = await this.tenantRepo.findOne({
        where: { user: { id: currentUserId } },
      });
      if (!tenant) return [];
      return this.requestRepo.find({
        where: { tenant: { id: tenant.id } },
        relations: ['tenant', 'tenant.user', 'unit', 'workOrders', 'workOrders.contractor', 'feedbacks'],
      });
    }

    return [];
  }

  async getContractors() {
    return this.contractorRepo.find({ relations: ['user'] });
  }

  async createContractor(dto: {
    name: string;
    phone: string;
    specialization: string;
  }) {
    return this.contractorRepo.save(dto);
  }

  async updateContractor(id: string, dto: any) {
    return this.contractorRepo.update(id, dto);
  }

  async getWorkOrders() {
    return this.workOrderRepo.find({
      relations: ['request', 'request.tenant', 'request.unit', 'contractor'],
      order: { created_at: 'DESC' },
    });
  }

  async updateRequest(id: string, dto: any) {
    // Edit or cancel request
    return this.requestRepo.update(id, dto);
  }

  async convertToWorkOrder(dto: any) {
    // Convert request to work order, assign contractor
    const { assigned_by, request_id, contractor_id, scheduled_date, cost_estimate, photo_reported } = dto;

    const request = await this.requestRepo.findOne({ where: { id: request_id } });
    if (!request) {
      throw new NotFoundException('Maintenance request not found.');
    }
    
    const wo = this.workOrderRepo.create({
      assigned_by: assigned_by || 'system',
      contractor: { id: contractor_id },
      scheduled_date: scheduled_date ? new Date(scheduled_date) : undefined,
      cost_estimate: cost_estimate,
      request: { id: request_id },
      status: 'assigned',
      photo_reported: photo_reported,
    }) as unknown as WorkOrder;

    // Calculate Resolution SLA
    const resHours = this.getSlaResolutionHours(request.priority);
    const resDeadline = new Date();
    resDeadline.setHours(resDeadline.getHours() + resHours);
    wo.sla_resolution_deadline = resDeadline;

    await this.workOrderRepo.save(wo);

    // Update request status to ASSIGNED/IN_PROGRESS
    await this.requestRepo.update(request_id, { status: MaintenanceStatus.ASSIGNED });

    return wo;
  }

  async updateWorkOrderStatus(
    id: string,
    status: string,
    actualCost?: number,
    photo?: string,
  ) {
    const wo = await this.workOrderRepo.findOne({
      where: { id },
      relations: ['request'],
    });
    if (!wo) throw new NotFoundException('Work order not found');

    const updateData: any = { status };
    if (actualCost !== undefined) updateData.actual_cost = actualCost;

    if (status === 'in_progress' && photo) {
      updateData.photo_in_progress = photo;
      updateData.started_at = new Date();
    }
    if (status === 'completed') {
      if (photo) {
        updateData.photo_completed = photo;
        updateData.proofUrl = photo;
      }
      updateData.completed_at = new Date();
    }

    const result = await this.workOrderRepo.update(id, updateData);

    // Fetch work order and related entities for notification
    const workOrder = await this.workOrderRepo.findOne({
      where: { id },
      relations: ['request', 'request.tenant', 'contractor'],
    });
    if (!workOrder) return result;

    // Sync status with maintenance request
    if (workOrder.request) {
      await this.requestRepo.update(workOrder.request.id, { status: status.toUpperCase() as any });
    }

    // Status-based notifications
    if (status === MaintenanceStatus.IN_PROGRESS) {
      // Notify tenant
      if (workOrder.request && workOrder.request.tenant) {
        await this.notificationsService.notify(
          workOrder.request.tenant.user.id,
          'Maintenance Started',
          'A technician has started working on your maintenance request.',
          NotificationType.MAINTENANCE,
          { workOrderId: workOrder.id, requestId: workOrder.request.id },
        );
      }
    }
    // Cost Attribution: Create Expense record if actual cost is provided
    if (status === 'completed' && actualCost && actualCost > 0) {
      // Find building ID
      const detailedWO = await this.workOrderRepo.findOne({
        where: { id },
        relations: ['request', 'request.unit', 'request.unit.building'],
      });
      
      const buildingId = detailedWO?.request?.unit?.building?.id;
      if (buildingId) {
        await this.expenseRepo.save({
          amount: actualCost,
          date: new Date().toISOString().split('T')[0],
          category: 'MAINTENANCE',
          description: `Maintenance Work Order #${id}: ${detailedWO.request?.category}`,
          building: { id: buildingId },
        });
      }
    }

    return result;
  }

  async trackSLA(id: string) {
    // Calculate SLA timer
    const workOrder = await this.workOrderRepo.findOne({ where: { id } });
    if (!workOrder) throw new NotFoundException('Work order not found.');
    if (!workOrder.started_at || !workOrder.completed_at) {
      return null; // Cannot calculate SLA if start or end is missing
    }
    return (
      (workOrder.completed_at.getTime() - workOrder.started_at.getTime()) / 1000
    );
  }

  async submitFeedback(dto: any) {
    // Validate work order completion and tenant association
    const workOrder = await this.workOrderRepo.findOne({
      where: { id: dto.work_order_id },
      relations: ['request', 'request.tenant', 'contractor', 'contractor.user'],
    });

    if (!workOrder) throw new NotFoundException('Work order not found.');
    if (workOrder.status?.toUpperCase() !== 'COMPLETED') {
      throw new BadRequestException(
        'Feedback can only be submitted for completed work orders.',
      );
    }
    
    if (workOrder.contractor?.user?.id === dto.tenant_id) {
      throw new BadRequestException('You cannot rate your own work order.');
    }

    // Save feedback
    const feedback = await this.feedbackRepo.save({
      request: workOrder.request,
      tenant: workOrder.request.tenant,
      rating: dto.rating,
      comment: dto.comment,
    });

    // Recalculate contractor average rating
    if (workOrder.contractor) {
      // Get all completed work orders for this contractor
      const contractorWorkOrders = await this.workOrderRepo.find({
        where: { contractor: { id: workOrder.contractor.id } },
        relations: ['request'],
      });

      // Get all feedback for those work orders' requests
      const requestIds = contractorWorkOrders.map(wo => wo.request?.id).filter(Boolean);
      if (requestIds.length > 0) {
        const allFeedback = await this.feedbackRepo.find({
          where: requestIds.map(rid => ({ request: { id: rid } })),
        });

        if (allFeedback.length > 0) {
          const avgRating = allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length;
          await this.contractorRepo.update(workOrder.contractor.id, {
            rating: Math.round(avgRating * 100) / 100,
          });
        }
      }
    }

    return feedback;
  }

  async getDashboardKpis() {
    // KPIs: Avg resolution time, contractor performance

    // 1. Average resolution time in seconds
    const completedOrders = await this.workOrderRepo.find({
      where: { status: MaintenanceStatus.COMPLETED as any },
    });

    const totalResolutionTime = completedOrders.reduce((sum, wo) => {
      const startTime = wo.started_at?.getTime();
      const completedTime = wo.completed_at?.getTime();
      if (startTime && completedTime) {
        return sum + (completedTime - startTime);
      }
      return sum;
    }, 0);

    const avgResolutionTime = completedOrders.length
      ? totalResolutionTime / completedOrders.length / 1000 // Convert ms to seconds
      : 0;

    // 2. Contractor performance ranking
    const contractors = await this.contractorRepo.find();
    const contractorStats = await Promise.all(
      contractors.map(async (contractor) => {
        const orders = await this.workOrderRepo.find({
          where: {
            contractor: { id: contractor.id },
            status: MaintenanceStatus.COMPLETED as any,
          },
        });

        const avgCost = orders.length
          ? orders.reduce((sum, wo) => sum + (wo.actual_cost || 0), 0) /
            orders.length
          : 0;

        return {
          contractor_id: contractor.id,
          name: contractor.name,
          avgCost,
          completedOrders: orders.length,
        };
      }),
    );

    // 3. Monthly maintenance cost trends (last 6 months)
    const monthlyTrends = await this.workOrderRepo
      .createQueryBuilder('wo')
      .select("to_char(wo.completed_at, 'Mon')", 'month')
      .addSelect('SUM(wo.actual_cost)', 'total')
      .where('wo.status = :status', { status: MaintenanceStatus.COMPLETED as any })
      .andWhere('wo.completed_at IS NOT NULL')
      .groupBy('month')
      .getRawMany();

    const pendingRequestsCount = await this.requestRepo.count({
      where: [
        { status: MaintenanceStatus.SUBMITTED },
        { status: MaintenanceStatus.ASSIGNED },
        { status: MaintenanceStatus.IN_PROGRESS },
      ],
    });

    return {
      avgResolutionTime,
      contractorStats,
      pendingRequestsCount,
      monthlyTrends: monthlyTrends.map(t => ({ month: t.month, total: Number(t.total) })),
    };
  }

  // --- Maintenance Schedules ---
  async createSchedule(dto: CreateMaintenanceScheduleDto) {
    return this.scheduleRepo.save(dto);
  }

  async getSchedules(building_id?: string) {
    const qb = this.scheduleRepo.createQueryBuilder('s').leftJoinAndSelect('s.building', 'b');
    if (building_id) qb.where('s.building_id = :bid', { bid: building_id });
    return qb.getMany();
  }

  async updateSchedule(id: string, dto: any) {
    return this.scheduleRepo.update(id, dto);
  }

  async deleteSchedule(id: string) {
    return this.scheduleRepo.delete(id);
  }

  async runMaintenanceCron() {
    const today = new Date().toISOString().split('T')[0];
    const schedules = await this.scheduleRepo.find({
      where: { is_active: true },
      relations: ['building'],
    });

    let generatedRequests = 0;

    for (const schedule of schedules) {
      if (schedule.next_due_date <= today) {
        // Create Request
        const request = this.requestRepo.create({
          category: schedule.category,
          priority: schedule.priority,
          description: `Auto-generated from schedule: ${schedule.name}. ${schedule.description || ''}`,
          status: MaintenanceStatus.SUBMITTED,
          unit: undefined, // Building level
        }) as unknown as MaintenanceRequest;

        // Calculate SLA Deadline (Acknowledgment)
        const hours = this.getSlaAcknowledgmentHours(request.priority);
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + hours);
        request.sla_deadline = deadline;

        await this.requestRepo.save(request);
        
        // Advance next_due_date
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + schedule.frequency_days);
        schedule.next_due_date = nextDate.toISOString().split('T')[0];
        await this.scheduleRepo.save(schedule);
        
        generatedRequests++;
      }
    }
    return { generatedRequests };
  }

  async runSlaCheckCron() {
    const now = new Date();

    // Check Requests (Acknowledgment SLA)
    const openRequests = await this.requestRepo.find({
      where: {
        status: MaintenanceStatus.SUBMITTED,
        is_sla_breached: false,
      },
    });

    let reqBreached = 0;
    for (const req of openRequests) {
      if (req.sla_deadline && req.sla_deadline < now) {
        req.is_sla_breached = true;
        await this.requestRepo.save(req);
        reqBreached++;
      }
    }

    // Check Work Orders (Resolution SLA)
    const activeWOs = await this.workOrderRepo.find({
      where: [
        { status: 'assigned', is_resolution_breached: false },
        { status: 'in_progress', is_resolution_breached: false },
      ],
    });

    let woBreached = 0;
    for (const wo of activeWOs) {
      if (wo.sla_resolution_deadline && wo.sla_resolution_deadline < now) {
        wo.is_resolution_breached = true;
        await this.workOrderRepo.save(wo);
        woBreached++;
      }
    }

    return { reqBreached, woBreached };
  }
}
