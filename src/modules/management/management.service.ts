import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ManagementCompany } from './entities/management-company.entity';
import { ManagementAssignment, ManagementScope } from './entities/management-assignment.entity';
import { ManagementPermission } from './entities/management-permission.entity';

@Injectable()
export class ManagementService {
  constructor(
    @InjectRepository(ManagementCompany)
    private readonly companyRepo: Repository<ManagementCompany>,
    @InjectRepository(ManagementAssignment)
    private readonly assignmentRepo: Repository<ManagementAssignment>,
    @InjectRepository(ManagementPermission)
    private readonly permissionRepo: Repository<ManagementPermission>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * MANAGEMENT COMPANIES
   */
  async createCompany(dto: any) {
    try {
      const company = this.companyRepo.create(dto);
      return await this.companyRepo.save(company);
    } catch (error) {
      if (error.code === '23505') { // Postgres unique violation
        throw new ConflictException('A management company with this name already exists');
      }
      throw error;
    }
  }

  async getCompanies() {
    return this.companyRepo.find({ relations: ['assignments'] });
  }

  async getCompany(id: string) {
    const company = await this.companyRepo.findOne({ where: { id }, relations: ['assignments'] });
    if (!company) throw new NotFoundException('Management company not found');
    return company;
  }

  /**
   * ASSIGNMENTS
   */
  async createAssignment(dto: any) {
    // Sanitize inputs
    const building_id = dto.building_id || null;
    const unit_id = dto.unit_id || null;
    const scope_type = dto.scope_type;

    // Prevent overlapping active assignments for the same scope
    const existing = await this.assignmentRepo.findOne({
      where: {
        building_id: building_id as any,
        unit_id: unit_id as any,
        scope_type: scope_type,
        is_active: true,
      },
    });

    if (existing) {
      throw new ConflictException('An active assignment already exists for this scope');
    }

    return this.dataSource.transaction(async (manager) => {
      const assignment = manager.getRepository(ManagementAssignment).create({
        ...dto,
        building_id,
        unit_id,
        start_date: dto.start_date || new Date().toISOString().split('T')[0],
      });
      const savedAssignment = (await manager.save(assignment)) as any as ManagementAssignment;

      // Create default permissions
      const permissions = manager.getRepository(ManagementPermission).create({
        assignment_id: savedAssignment.id,
        can_manage_tenants: true,
        can_manage_leases: true,
        can_manage_maintenance: true,
        can_view_financials: false,
      });
      await manager.save(permissions);

      return savedAssignment;
    });
  }

  async getAssignments(company_id?: string) {
    const where: any = {};
    if (company_id) where.company_id = company_id;
    return this.assignmentRepo.find({
      where,
      relations: ['company', 'building', 'unit'],
      order: { created_at: 'DESC' },
    });
  }

  async updatePermissions(assignment_id: string, dto: any) {
    const permissions = await this.permissionRepo.findOne({ where: { assignment_id } });
    if (!permissions) throw new NotFoundException('Permissions not found for this assignment');
    Object.assign(permissions, dto);
    return this.permissionRepo.save(permissions);
  }
}
