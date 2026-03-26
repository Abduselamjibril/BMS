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
import { UserBuilding } from '../users/entities/user-building.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

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
    private readonly notificationsService: NotificationsService,
  ) {}

  async submitRequest(dto: any, authorId?: string) {
    let targetTenantId = dto.tenant_id;

    // Security: If authorId is provided (from token), verify they are not spoofing another tenant
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
        if (tenant) targetTenantId = tenant.id; // Force their own ID
      }
    }

    return this.requestRepo.save({
      ...dto,
      tenant: { id: targetTenantId },
      unit: { id: dto.unit_id },
    });
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
    const { assigned_by, request_id, contractor_id, scheduled_date, cost_estimate } = dto;
    
    const workOrder = await this.workOrderRepo.save({
      assigned_by,
      contractor: { id: contractor_id },
      scheduled_date,
      cost_estimate,
      request: { id: request_id },
    });

    // Update request status to ASSIGNED/IN_PROGRESS
    await this.requestRepo.update(request_id, { status: MaintenanceStatus.ASSIGNED });

    return workOrder;
  }

  async updateWorkOrderStatus(
    id: string,
    status: string,
    actual_cost?: number,
    proof?: Express.Multer.File,
  ) {
    // Prevent 'completed' status if no proof photo
    if (status === 'completed' && !proof) {
      throw new BadRequestException('A proof of completion photo is required.');
    }
    // Optionally, save proof file info (e.g., filename) to work order
    const updateData: any = { status };
    if (proof) {
      updateData.proofUrl = proof.path || proof.originalname;
    }
    if (actual_cost) {
      updateData.actual_cost = actual_cost;
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
    if (status === MaintenanceStatus.COMPLETED) {
      // Notify tenant
      if (workOrder.request && workOrder.request.tenant) {
        await this.notificationsService.notify(
          workOrder.request.tenant.user.id,
          'Maintenance Completed',
          'Your maintenance request has been completed. Please review and rate the service.',
          NotificationType.MAINTENANCE,
          {
            workOrderId: workOrder.id,
            requestId: workOrder.request.id,
            proof: updateData.proofUrl,
          },
        );
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

    return {
      avgResolutionTime,
      contractorStats,
    };
  }
}
