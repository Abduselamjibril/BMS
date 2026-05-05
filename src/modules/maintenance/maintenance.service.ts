import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Expense } from '../finance/entities/expense.entity';
import { ManagementAssignment, ManagementScope } from '../management/entities/management-assignment.entity';
import { CommissionCalculationService } from '../commission/services/commission-calculation.service';
import { CommissionBasis } from '../commission/entities/commission-rule.entity';
import { Owner } from '../owners/entities/owner.entity';
import { Building } from '../buildings/entities/building.entity';

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
    @InjectRepository(Owner)
    private readonly ownerRepo: Repository<Owner>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    private readonly notificationsService: NotificationsService,
    private readonly commissionCalculationService: CommissionCalculationService,
  ) { }

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
      tenant: targetTenantId ? { id: targetTenantId } : undefined,
      unit: dto.unit_id ? { id: dto.unit_id } : undefined,
      building: dto.building_id ? { id: dto.building_id } : undefined,
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

    // Admin see all requests
    if (isAdmin) {
      return this.requestRepo.find({ relations: ['tenant', 'tenant.user', 'unit', 'workOrders', 'workOrders.contractor', 'feedbacks'] });
    }

    // Contractor scoping
    if (isContractor) {
      const contractor = await this.contractorRepo.findOne({
        where: { user: { id: currentUserId } },
      });
      
      if (!contractor) return [];

      return this.requestRepo
        .createQueryBuilder('request')
        .innerJoinAndSelect('request.workOrders', 'wo')
        .leftJoinAndSelect('wo.contractor', 'contractor')
        .leftJoinAndSelect('request.tenant', 'tenant')
        .leftJoinAndSelect('tenant.user', 'user')
        .leftJoinAndSelect('request.unit', 'unit')
        .leftJoinAndSelect('request.feedbacks', 'feedbacks')
        .andWhere('contractor.id = :cid', { cid: contractor.id })
        .getMany();
    }

    if (roleNames.includes('owner')) {
      const owner = await this.ownerRepo.findOne({ where: { user: { id: currentUserId } } });
      if (!owner) return [];

      const qb = this.requestRepo
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.tenant', 'tenant')
        .leftJoinAndSelect('tenant.user', 'user')
        .leftJoinAndSelect('request.unit', 'unit')
        .leftJoinAndSelect('unit.building', 'building')
        .leftJoinAndSelect('request.building', 'directBuilding')
        .leftJoinAndSelect('request.workOrders', 'workOrders')
        .leftJoinAndSelect('workOrders.contractor', 'contractor')
        .leftJoinAndSelect('request.feedbacks', 'feedbacks')
        .where('(building.ownerId = :oid OR directBuilding.ownerId = :oid)', { oid: owner.id });

      return qb.getMany();
    }

    if (roleNames.includes('nominee_admin')) {
      const buildingIds: string[] = [];
      const unitIds: string[] = [];

      // 1. Existing UserBuilding check (Legacy)
      const assignments = await this.userBuildingRepo.find({
        where: { user: { id: currentUserId } },
        relations: ['building'],
      });
      assignments.forEach((a) => buildingIds.push(a.building.id));

      // 2. New ManagementAssignment check (Scoped)
      const user = await this.requestRepo.manager.getRepository(User).findOne({
        where: { id: currentUserId },
      });

      if (user?.company_id) {
        const mgmtAssignments = await this.requestRepo.manager.getRepository(ManagementAssignment).find({
          where: { company_id: user.company_id, is_active: true },
        });

        for (const ma of mgmtAssignments) {
          if (ma.scope_type === ManagementScope.BUILDING && ma.building_id) {
            buildingIds.push(ma.building_id);
          } else if (ma.scope_type === ManagementScope.UNIT && ma.unit_id) {
            unitIds.push(ma.unit_id);
          }
        }
      }

      const qb = this.requestRepo
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.tenant', 'tenant')
        .leftJoinAndSelect('tenant.user', 'user')
        .leftJoinAndSelect('request.unit', 'unit')
        .leftJoinAndSelect('request.workOrders', 'workOrders')
        .leftJoinAndSelect('workOrders.contractor', 'contractor')
        .leftJoinAndSelect('request.feedbacks', 'feedbacks');

      if (buildingIds.length > 0 || unitIds.length > 0) {
        if (buildingIds.length > 0 && unitIds.length > 0) {
          qb.where('(unit.building_id IN (:...bids) OR unit.id IN (:...uids))', { bids: [...new Set(buildingIds)], uids: [...new Set(unitIds)] });
        } else if (buildingIds.length > 0) {
          qb.where('unit.building_id IN (:...bids)', { bids: [...new Set(buildingIds)] });
        } else {
          qb.where('unit.id IN (:...uids)', { uids: [...new Set(unitIds)] });
        }
      } else {
        return [];
      }

      return qb.getMany();
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

  async getWorkOrders(authenticatedUser?: any) {
    if (authenticatedUser) {
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        relations: ['role'],
      });
      const roleNames = userRoles.map(r => r.role.name);
      const isAdmin = roleNames.some(r => ['super_admin', 'admin'].includes(r));
      const isContractor = roleNames.includes('contractor');

      if (isContractor) {
        const contractor = await this.contractorRepo.findOne({
          where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        });
        if (contractor) {
          return this.workOrderRepo.find({
            where: { contractor: { id: contractor.id } },
            relations: ['request', 'request.tenant', 'request.unit', 'request.building', 'contractor'],
            order: { created_at: 'DESC' },
          });
        }
        return [];
      }

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({
          where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        });
        if (owner) {
          return this.workOrderRepo.find({
            where: [
              { request: { building: { owner: { id: owner.id } } } },
              { request: { unit: { building: { owner: { id: owner.id } } } } }
            ],
            relations: ['request', 'request.tenant', 'request.unit', 'request.building', 'contractor'],
            order: { created_at: 'DESC' },
          });
        }
        return [];
      }
    }

    return this.workOrderRepo.find({
      relations: ['request', 'request.tenant', 'request.unit', 'request.building', 'contractor'],
      order: { created_at: 'DESC' },
    });
  }

  async updateRequest(id: string, dto: any, authenticatedUser?: any) {
    if (authenticatedUser) {
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        relations: ['role'],
      });
      const roleNames = userRoles.map(r => r.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({
          where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        });
        if (owner) {
          const req = await this.requestRepo.findOne({
            where: [
              { id, building: { owner: { id: owner.id } } },
              { id, unit: { building: { owner: { id: owner.id } } } }
            ],
          });
          if (!req) throw new ForbiddenException('You do not have access to this request');
        }
      }
    }
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

      // --- COMMISSION HOOK ---
      // If the request is managed by a company and is completed, trigger maintenance commission calculation
      if (status === 'completed' && actualCost && workOrder.request.managed_by_company_id) {
        await this.commissionCalculationService.calculateFromSource(
          CommissionBasis.MAINTENANCE,
          workOrder.id,
          actualCost,
          workOrder.request.managed_by_company_id,
          workOrder.request.unit?.building_id,
        );
      }
      // -----------------------
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

  async getDashboardKpis(buildingIds?: string[], authenticatedUser?: any) {
    let finalBuildingIds = buildingIds;

    if (authenticatedUser) {
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        relations: ['role'],
      });
      const roleNames = userRoles.map(r => r.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({
          where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        });
        if (owner) {
          const buildings = await this.buildingRepo.find({
            where: { owner: { id: owner.id } },
            select: ['id'],
          });
          const ownerBuildingIds = buildings.map(b => b.id);
          if (ownerBuildingIds.length === 0) return {
            avgResolutionTime: 0,
            contractorStats: [],
            pendingRequestsCount: 0,
            monthlyTrends: [],
          };
          
          if (buildingIds) {
            finalBuildingIds = buildingIds.filter(id => ownerBuildingIds.includes(id));
          } else {
            finalBuildingIds = ownerBuildingIds;
          }
        }
      }
    }

    const bids = finalBuildingIds;
    // KPIs: Avg resolution time, contractor performance

    // 1. Average resolution time in seconds
    const completedOrdersQb = this.workOrderRepo
      .createQueryBuilder('wo')
      .leftJoinAndSelect('wo.contractor', 'contractor')
      .innerJoin('wo.request', 'r')
      .leftJoin('r.unit', 'u')
      .where('wo.status IN (:...statuses)', { statuses: ['completed', 'COMPLETED', 'closed', 'CLOSED'] });

    if (bids) {
      completedOrdersQb.andWhere('(r.building IN (:...bids_list) OR u.building IN (:...bids_list))', { bids_list: bids });
    }

    const completedOrders = await completedOrdersQb.getMany();

    const totalResolutionTime = completedOrders.reduce((sum, wo) => {
      const startTime = wo.started_at?.getTime() || wo.created_at?.getTime();
      const completedTime = wo.completed_at?.getTime();
      if (startTime && completedTime) {
        return sum + Math.max(0, completedTime - startTime);
      }
      return sum;
    }, 0);

    const avgResolutionTime = completedOrders.length
      ? totalResolutionTime / completedOrders.length / 1000 // Convert ms to seconds
      : 0;

    // 2. Contractor performance ranking (filtered by work orders in scoped buildings)
    const contractors = await this.contractorRepo.find();
    const contractorStats = await Promise.all(
      contractors.map(async (contractor) => {
        const orders = completedOrders.filter(
          (wo) => wo.contractor?.id === contractor.id,
        );

        const avgCost = orders.length
          ? orders.reduce((sum, wo) => sum + Number(wo.actual_cost || 0), 0) /
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
    const monthlyTrendsQb = this.workOrderRepo
      .createQueryBuilder('wo')
      .select("to_char(wo.completed_at, 'Mon')", 'month')
      .addSelect('SUM(wo.actual_cost)', 'total')
      .innerJoin('wo.request', 'r')
      .leftJoin('r.unit', 'u')
      .where('wo.status = :status', { status: MaintenanceStatus.COMPLETED as any })
      .andWhere('wo.completed_at IS NOT NULL');

    if (bids) {
      monthlyTrendsQb.andWhere('(r.building IN (:...bids_list) OR u.building IN (:...bids_list))', { bids_list: bids });
    }

    const monthlyTrends = await monthlyTrendsQb.groupBy('month').getRawMany();

    // 4. Pending Requests Count
    const pendingQb = this.requestRepo.createQueryBuilder('r')
      .leftJoin('r.unit', 'u')
      .where('r.status IN (:...statuses)', { 
        statuses: [MaintenanceStatus.SUBMITTED, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS] 
      });

    if (bids) {
      pendingQb.andWhere('(r.building IN (:...bids_list) OR u.building IN (:...bids_list))', { bids_list: bids });
    }

    const pendingRequestsCount = await pendingQb.getCount();

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

  async getSchedules(building_id?: string, authenticatedUser?: any) {
    const qb = this.scheduleRepo.createQueryBuilder('s').leftJoinAndSelect('s.building', 'b');
    
    if (authenticatedUser) {
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        relations: ['role'],
      });
      const roleNames = userRoles.map(r => r.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({
          where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        });
        if (owner) {
          qb.andWhere('b.ownerId = :oid', { oid: owner.id });
        } else {
          return [];
        }
      }
    }

    if (building_id) qb.andWhere('s.building_id = :bid', { bid: building_id });
    return qb.getMany();
  }

  async updateSchedule(id: string, dto: any, authenticatedUser?: any) {
    if (authenticatedUser) {
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        relations: ['role'],
      });
      const roleNames = userRoles.map(r => r.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({
          where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        });
        if (owner) {
          const sch = await this.scheduleRepo.findOne({
            where: { id, building: { owner: { id: owner.id } } },
          });
          if (!sch) throw new ForbiddenException('You do not have access to this schedule');
        }
      }
    }
    return this.scheduleRepo.update(id, dto);
  }

  async deleteSchedule(id: string, authenticatedUser?: any) {
    if (authenticatedUser) {
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        relations: ['role'],
      });
      const roleNames = userRoles.map(r => r.role.name);

      if (roleNames.includes('owner')) {
        const owner = await this.ownerRepo.findOne({
          where: { user: { id: authenticatedUser.id || authenticatedUser.sub } },
        });
        if (owner) {
          const sch = await this.scheduleRepo.findOne({
            where: { id, building: { owner: { id: owner.id } } },
          });
          if (!sch) throw new ForbiddenException('You do not have access to this schedule');
        }
      }
    }
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
          unit: undefined,
          building: schedule.building,
          tenant: undefined,
        }) as MaintenanceRequest;

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
