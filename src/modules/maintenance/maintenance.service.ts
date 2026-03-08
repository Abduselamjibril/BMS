import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceRequest, MaintenanceStatus } from './entities/maintenance-request.entity';
import { WorkOrder, Contractor } from './entities/contractor-and-workorder.entity';
import { MaintenanceFeedback } from './entities/maintenance-feedback.entity';
import { UserBuilding } from '../users/entities/user-building.entity';

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
    private readonly notificationsService: NotificationsService,
  ) {}

  async submitRequest(dto: any) {
    // Validate tenant/unit, create request
    const { tenantId, unit_id, ...rest } = dto;
    return this.requestRepo.save({
      ...rest,
      tenant: { id: tenantId },
      unit: { id: unit_id }
    });
  }

  async getRequests(user: any) {
    // Scoped access: managers see building, tenants see own
    if (user.role === 'tenant') {
      return this.requestRepo.find({ where: { tenant: { id: user.id } }, relations: ['tenant', 'unit'] });
    }
    if (user.role === 'nominee_admin') {
      // Find assigned buildings
      const assignments = await this.userBuildingRepo.find({
        where: { user: { id: user.id } },
        relations: ['building'],
      });
      if (!assignments.length) {
        return []; // No buildings assigned, return empty array
      }
      const buildingIds = assignments.map(a => a.building.id);
      // Find requests for these buildings
      return this.requestRepo.createQueryBuilder('request')
        .leftJoinAndSelect('request.unit', 'unit')
        .where('unit.building_id IN (:...buildingIds)', { buildingIds })
        .getMany();
    }
    // Super admin sees all
    return this.requestRepo.find({ relations: ['tenant', 'unit'] });
  }

  async getContractors() {
    return this.contractorRepo.find();
  }

  async createContractor(dto: { name: string; phone: string; specialization: string }) {
    return this.contractorRepo.save(dto);
  }

  async getWorkOrders() {
    return this.workOrderRepo.find({
      relations: ['request', 'request.tenant', 'request.unit', 'contractor'],
      order: { scheduled_date: 'DESC' },
    });
  }

  async updateRequest(id: string, dto: any) {
    // Edit or cancel request
    return this.requestRepo.update(id, dto);
  }

  async convertToWorkOrder(dto: any) {
    // Convert request to work order, assign contractor
    const { assigned_by, request_id, contractor_id, scheduled_date } = dto;
    return this.workOrderRepo.save({
      assigned_by,
      contractor: { id: contractor_id },
      scheduled_date,
      request: { id: request_id }
    });
  }

  async updateWorkOrderStatus(id: string, status: string, proof?: Express.Multer.File) {
    // Prevent 'completed' status if no proof photo
    if (status === 'completed' && !proof) {
      throw new BadRequestException('A proof of completion photo is required.');
    }
    // Optionally, save proof file info (e.g., filename) to work order
    const updateData: any = { status };
    if (proof) {
      updateData.proofUrl = proof.path || proof.originalname;
    }
    const result = await this.workOrderRepo.update(id, updateData);

    // Fetch work order and related entities for notification
    const workOrder = await this.workOrderRepo.findOne({
      where: { id },
      relations: ['request', 'request.tenant', 'contractor'],
    });
    if (!workOrder) return result;

    // Status-based notifications
    if (status === 'in_progress') {
      // Notify tenant
      if (workOrder.request && workOrder.request.tenant) {
        await this.notificationsService.notify(
          workOrder.request.tenant.id,
          'Maintenance Started',
          'A technician has started working on your maintenance request.',
          NotificationType.MAINTENANCE,
          { workOrderId: workOrder.id, requestId: workOrder.request.id }
        );
      }
    }
    if (status === 'completed') {
      // Notify tenant
      if (workOrder.request && workOrder.request.tenant) {
        await this.notificationsService.notify(
          workOrder.request.tenant.id,
          'Maintenance Completed',
          'Your maintenance request has been completed. Please review and rate the service.',
          NotificationType.MAINTENANCE,
          { workOrderId: workOrder.id, requestId: workOrder.request.id, proof: updateData.proofUrl }
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
    return (workOrder.completed_at.getTime() - workOrder.started_at.getTime()) / 1000;
  }

  async submitFeedback(dto: any) {
    // Validate work order completion and tenant association
    const workOrder = await this.workOrderRepo.findOne({
      where: { id: dto.work_order_id },
      relations: ['request', 'request.tenant'], // Eagerly load tenant for validation
    });

    if (!workOrder) throw new NotFoundException('Work order not found.');
    if (workOrder.status !== 'completed') {
      throw new BadRequestException('Feedback can only be submitted for completed work orders.');
    }
    if (workOrder.request.tenant.id !== dto.tenant_id) {
      throw new BadRequestException('This tenant is not associated with the work order.');
    }

    // Save feedback
    return this.feedbackRepo.save({
      request: workOrder.request,
      tenant: { id: dto.tenant_id },
      rating: dto.rating,
      comment: dto.comment,
    });
  }

  async getDashboardKpis() {
    // KPIs: Avg resolution time, contractor performance

    // 1. Average resolution time in seconds
    const completedOrders = await this.workOrderRepo.find({
      where: { status: 'completed' }
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
      ? (totalResolutionTime / completedOrders.length) / 1000 // Convert ms to seconds
      : 0;

    // 2. Contractor performance ranking
    const contractors = await this.contractorRepo.find();
    const contractorStats = await Promise.all(contractors.map(async (contractor) => {
      const orders = await this.workOrderRepo.find({
        where: { contractor: { id: contractor.id }, status: 'completed' },
      });

      const avgCost = orders.length
        ? orders.reduce((sum, wo) => sum + (wo.actual_cost || 0), 0) / orders.length
        : 0;

      return {
        contractor_id: contractor.id,
        name: contractor.name,
        avgCost,
        completedOrders: orders.length,
      };
    }));

    return {
      avgResolutionTime,
      contractorStats,
    };
  }
}