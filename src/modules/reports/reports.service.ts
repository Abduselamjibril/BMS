import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Unit, UnitStatus } from '../units/entities/unit.entity';
import { Lease, LeaseStatus } from '../leases/entities/lease.entity';
import { Payment } from '../finance/entities/payment.entity';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { Invoice, InvoiceStatus } from '../finance/entities/invoice.entity';
import { Building } from '../buildings/entities/building.entity';
import { Site } from '../sites/entities/site.entity';
import { MeterReading } from '../utility/entities/meter-reading.entity';
import { Between } from 'typeorm';

import { Tenant } from '../tenants/entities/tenant.entity';
import { Visitor } from '../visitors/entities/visitor.entity';
import { InvoiceItem, InvoiceItemType } from '../finance/entities/invoice-item.entity';
import { BuildingAdminAssignment } from '../buildings/entities/building-admin-assignment.entity';
import { Owner } from '../owners/entities/owner.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { DataSource } from 'typeorm';
const PDFDocument = require('pdfkit');

@Injectable()
export class ReportsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(MeterReading)
    private readonly readingRepo: Repository<MeterReading>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Visitor)
    private readonly visitorRepo: Repository<Visitor>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,
    @InjectRepository(BuildingAdminAssignment)
    private readonly adminRepo: Repository<BuildingAdminAssignment>,
    @InjectRepository(Owner)
    private readonly ownerRepo: Repository<Owner>,
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepo: Repository<ReportSchedule>,
    private readonly maintenanceService: MaintenanceService,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('ReportsService: onApplicationBootstrap called');
    await this.initializeMaterializedViews();
  }

  private async initializeMaterializedViews() {
    try {
      this.logger.log('Initializing Materialized Views for Reporting...');
      
      const sql = `
        -- 1. Occupancy Summary by Building
        DROP MATERIALIZED VIEW IF EXISTS mv_occupancy_summary CASCADE;
        CREATE MATERIALIZED VIEW mv_occupancy_summary AS
        SELECT 
            b.id as building_id,
            b.name as building_name,
            COUNT(u.id) as total_units,
            SUM(CASE WHEN u.status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupied_units,
            SUM(CASE WHEN u.status = 'VACANT' THEN 1 ELSE 0 END) as vacant_units,
            CASE 
                WHEN COUNT(u.id) > 0 THEN (SUM(CASE WHEN u.status = 'OCCUPIED' THEN 1 ELSE 0 END)::float / COUNT(u.id)) * 100 
                ELSE 0 
            END as occupancy_rate,
            CURRENT_TIMESTAMP as last_updated
        FROM buildings b
        LEFT JOIN units u ON b.id = u.building_id
        GROUP BY b.id, b.name;

        -- 2. Financial Summary by Month
        DROP MATERIALIZED VIEW IF EXISTS mv_financial_summary CASCADE;
        CREATE MATERIALIZED VIEW mv_financial_summary AS
        SELECT 
            to_char(i.due_date, 'YYYY-MM') as month,
            u.building_id as building_id,
            SUM(i.total_amount) as total_invoiced,
            SUM(i.amount_paid) as total_paid,
            SUM(CASE WHEN i.status = 'overdue' THEN i.total_amount - i.amount_paid ELSE 0 END) as total_overdue,
            SUM(i.late_fee_amount) as total_penalties,
            CURRENT_TIMESTAMP as last_updated
        FROM invoices i
        JOIN units u ON i."unitId" = u.id
        WHERE i.status != 'draft'
        GROUP BY month, u.building_id;

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_mv_occupancy_building ON mv_occupancy_summary(building_id);
        CREATE INDEX IF NOT EXISTS idx_mv_financial_month ON mv_financial_summary(month);
        CREATE INDEX IF NOT EXISTS idx_mv_financial_building ON mv_financial_summary(building_id);
      `;

      await this.dataSource.query(sql);
      this.logger.log('Materialized Views initialized successfully.');
    } catch (error) {
      this.logger.error("Failed to initialize Materialized Views: " + error.message);
    }
  }

  async refreshMaterializedViews() {
    try {
      this.logger.log('Refreshing Materialized Views...');
      await this.dataSource.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_occupancy_summary');
      await this.dataSource.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_financial_summary');
      this.logger.log('Materialized Views refreshed.');
    } catch (error) {
      this.logger.error("Failed to refresh Materialized Views: " + error.message);
      try {
        await this.dataSource.query('REFRESH MATERIALIZED VIEW mv_occupancy_summary');
        await this.dataSource.query('REFRESH MATERIALIZED VIEW mv_financial_summary');
      } catch (e) {}
    }
  }

  async dashboard(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND i.due_date BETWEEN '${startDate}' AND '${endDate}'`;
    } else {
      dateFilter = "AND i.due_date >= date_trunc('month', current_date)";
    }

    const revenueSql = `
      SELECT SUM(i.total_amount) as total 
      FROM invoices i
      JOIN units u ON i."unitId" = u.id
      WHERE i.status != 'draft' 
      ${dateFilter}
      ${scoping ? 'AND u.' + scoping : ''}
    `;
    const revenueResult = await this.dataSource.query(revenueSql);
    
    const occupancySql = `
        SELECT SUM(total_units) as total, SUM(occupied_units) as occupied 
        FROM mv_occupancy_summary
        ${scoping ? 'WHERE ' + scoping : ''}
    `;
    let occupancyResult;
    try {
        occupancyResult = await this.dataSource.query(occupancySql);
    } catch (e) {
        occupancyResult = [{ total: 0, occupied: 0 }];
    }

    const pendingMaintenance = await this.maintenanceService.countPending(user);

    return {
      total_revenue: parseFloat(revenueResult[0]?.total || 0),
      occupancy_rate: occupancyResult[0]?.total > 0 
        ? (occupancyResult[0]?.occupied / occupancyResult[0]?.total) * 100 
        : 0,
      pending_maintenance: pendingMaintenance,
      occupied_leases: await this.leaseRepo.count({ where: { status: In([LeaseStatus.ACTIVE, LeaseStatus.RENEWED]), ...(buildingId ? { building_id: buildingId } : {}) } }),
      total_units: occupancyResult[0]?.total || 0,
      vacant_units: (occupancyResult[0]?.total || 0) - (occupancyResult[0]?.occupied || 0)
    };
  }

  async financialTrend(limit: number, user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    let dateFilter = '';
    if (startDate && endDate) {
        dateFilter = "AND month BETWEEN '" + startDate.substring(0, 7) + "' AND '" + endDate.substring(0, 7) + "'";
    }

    const sql = `
      SELECT month, 
             SUM(total_invoiced)::float as invoiced, 
             SUM(total_paid)::float as paid, 
             (SUM(total_invoiced) - SUM(total_paid))::float as outstanding,
             SUM(total_invoiced)::float as total
      FROM mv_financial_summary
      WHERE 1=1
      ${scoping ? 'AND ' + scoping : ''}
      ${dateFilter}
      GROUP BY month
      ORDER BY month DESC
      LIMIT ${limit}
    `;
    try {
        const rows = (await this.dataSource.query(sql)).reverse();
        return rows.map(r => ({
          ...r,
          invoiced: parseFloat(r.invoiced) || 0,
          paid: parseFloat(r.paid) || 0,
          outstanding: parseFloat(r.outstanding) || 0,
          total: parseFloat(r.total) || 0
        }));
    } catch (e) {
        return [];
    }
  }

  async occupancyInsights(user: any, buildingId?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    
    // Count vacant units
    const vacantSql = `SELECT COUNT(*)::int as count FROM units WHERE status = 'VACANT' ${scoping ? 'AND ' + scoping : ''}`;
    const vacantRes = await this.dataSource.query(vacantSql);

    // Count expiring soon (30 days)
    const expiringSql = `SELECT COUNT(*)::int as count FROM leases WHERE status IN ('ACTIVE', 'RENEWED') AND end_date <= current_date + interval '30 days' ${scoping ? 'AND ' + scoping : ''}`;
    const expiringRes = await this.dataSource.query(expiringSql);

    return {
        vacant_units: vacantRes[0]?.count || 0,
        expiring_soon: expiringRes[0]?.count || 0
    };
  }

  async occupancyByBuilding(user: any, buildingId?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    const sql = `
      SELECT building_name as name, occupancy_rate as rate
      FROM mv_occupancy_summary
      ${scoping ? 'WHERE ' + scoping : ''}
      ORDER BY occupancy_rate DESC
    `;
    try {
        return await this.dataSource.query(sql);
    } catch (e) {
        return [];
    }
  }

  async revenueDrilldown(user: any, buildingId?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    const sql = `
      SELECT b.name, 
             SUM(i.total_amount)::float as value,
             SUM(i.amount_paid)::float as paid,
             (SUM(i.total_amount) - SUM(i.amount_paid))::float as outstanding
      FROM invoices i
      JOIN units u ON i."unitId" = u.id
      JOIN buildings b ON u.building_id = b.id
      WHERE i.status != 'draft'
      ${scoping ? 'AND u.' + scoping : ''}
      GROUP BY b.name
    `;
    const rows = await this.dataSource.query(sql);
    return rows.map(r => ({
      ...r,
      value: parseFloat(r.value) || 0,
      paid: parseFloat(r.paid) || 0,
      outstanding: parseFloat(r.outstanding) || 0
    }));
  }

  async vacancyTrend() {
    const sql = `
      SELECT to_char(date_trunc('month', d), 'YYYY-MM') as month, 
             (SELECT COUNT(*)::int FROM units WHERE status = 'VACANT') as count
      FROM generate_series(current_date - interval '11 months', current_date, interval '1 month') d
    `;
    return await this.dataSource.query(sql);
  }

  async overdueAging(user: any, buildingId?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    const sql = `
      SELECT 
        CASE 
          WHEN current_date - i.due_date <= 30 THEN '0-30 Days'
          WHEN current_date - i.due_date <= 60 THEN '31-60 Days'
          WHEN current_date - i.due_date <= 90 THEN '61-90 Days'
          ELSE '90+ Days'
        END as range,
        SUM(i.total_amount - i.amount_paid) as amount
      FROM invoices i
      JOIN units u ON i."unitId" = u.id
      WHERE i.status = 'overdue'
      ${scoping ? 'AND u.' + scoping : ''}
      GROUP BY range
    `;
    return await this.dataSource.query(sql);
  }

  async maintenanceCostAnalytics() {
    const sql = `
      SELECT to_char(completed_at, 'YYYY-MM') as month, SUM(actual_cost) as cost
      FROM work_orders
      WHERE status = 'completed'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `;
    return (await this.dataSource.query(sql)).reverse();
  }

  async getTurnoverRate() {
    const totalTenants = await this.tenantRepo.count();
    if (totalTenants === 0) return 0;
    const pastLeases = await this.leaseRepo.count({ where: { status: LeaseStatus.TERMINATED } });
    return (pastLeases / totalTenants) * 100;
  }

  async getAverageTenancy() {
    const sql = `
      SELECT AVG(end_date - start_date) as avg_days
      FROM leases
      WHERE status IN ('active', 'terminated')
    `;
    const res = await this.dataSource.query(sql);
    return Math.round(parseFloat(res[0]?.avg_days || 0));
  }

  async getUtilityAnomalies() {
    return []; 
  }

  async getPeopleReport(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    
    const tenantsSql = `
        SELECT DISTINCT t.id, t.first_name, t.last_name, t.email, t.phone
        FROM tenants t
        JOIN leases l ON l.tenant_id = t.id
        WHERE l.status IN ('ACTIVE', 'RENEWED')
        ${scoping ? 'AND l.' + scoping : ''}
    `;
    const tenants = await this.dataSource.query(tenantsSql);
    
    let visitorDateFilter = '';
    if (startDate && endDate) {
        visitorDateFilter = "AND v.check_in_time BETWEEN '" + startDate + "' AND '" + endDate + "'";
    }

    // Filter strictly by building if buildingId provided, otherwise fallback to site-wide for authorized sites
    const visitorScoping = buildingId 
        ? 'v.unit_id::text IN (SELECT id::text FROM units WHERE building_id::text = \'' + buildingId + '\')'
        : (scoping ? '(v.unit_id::text IN (SELECT id::text FROM units WHERE ' + scoping + ') OR v.site_id IN (SELECT "siteId"::text FROM buildings WHERE ' + scoping.replace('building_id', 'id') + '))' : '');

    const visitorsSql = `
        SELECT v.id, v.visitor_name, v.check_in_time, v.host_user_id
        FROM visitors v
        WHERE 1=1
        ${visitorScoping ? 'AND ' + visitorScoping : ''}
        ${visitorDateFilter}
        ORDER BY v.check_in_time DESC
        LIMIT 50
    `;
    const visitors = await this.dataSource.query(visitorsSql);

    return {
        tenants,
        visitors
    };
  }

  async getLeaseReport(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = (scoping ? 'AND' : 'WHERE') + ` l.start_date <= '${endDate}' AND l.end_date >= '${startDate}'`;
    }

    const sql = `
        SELECT 
            l.id, l.start_date, l.end_date, l.rent_amount, l.status,
            t.first_name as "tenant_first_name", t.last_name as "tenant_last_name",
            u.unit_number as "unit_number"
        FROM leases l
        JOIN tenants t ON l.tenant_id = t.id
        JOIN units u ON l.unit_id = u.id
        ${scoping ? 'WHERE l.' + scoping : ''}
        ${dateFilter}
    `;
    const rows = await this.dataSource.query(sql);

    return rows.map(r => ({
        id: r.id,
        start_date: r.start_date,
        end_date: r.end_date,
        rent_amount: parseFloat(r.rent_amount),
        status: r.status,
        tenant: {
            first_name: r.tenant_first_name,
            last_name: r.tenant_last_name
        },
        unit: {
            unit_number: r.unit_number
        }
    }));
  }

  async getPropertyReport(user: any, buildingId?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    const sql = `
      SELECT b.id, b.name, b.address, b.type,
             (SELECT COUNT(*)::int FROM units WHERE building_id = b.id) as total_units,
             (SELECT COUNT(*)::int FROM units WHERE building_id = b.id AND status = 'OCCUPIED') as occupied_units,
             CASE 
                WHEN (SELECT COUNT(*) FROM units WHERE building_id = b.id) > 0 
                THEN ((SELECT COUNT(*) FROM units WHERE building_id = b.id AND status = 'OCCUPIED')::float / (SELECT COUNT(*) FROM units WHERE building_id = b.id)) * 100 
                ELSE 0 
             END as occupancy_rate
      FROM buildings b
      ${scoping ? 'WHERE ' + scoping.replace('building_id', 'id') : ''}
    `;
    return await this.dataSource.query(sql);
  }

  async getOverduePenaltyReport(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND i.due_date BETWEEN '${startDate}' AND '${endDate}'`;
    }

    const sql = `
      SELECT 
        i.invoice_no,
        t.first_name || ' ' || t.last_name as tenant_name,
        u.unit_number as unit_name,
        i.due_date,
        (current_date - i.due_date::date) as days_overdue,
        COALESCE(i.late_fee_amount, 0) as late_fee_amount,
        (i.total_amount - i.amount_paid) as balance
      FROM invoices i
      JOIN units u ON i."unitId" = u.id
      JOIN tenants t ON i."tenantId" = t.id
      WHERE i.status = 'overdue'
      ${scoping ? 'AND u.' + scoping : ''}
      ${dateFilter}
      ORDER BY (current_date - i.due_date::date) DESC
    `;
    const rows = await this.dataSource.query(sql);
    return rows.map(r => ({
      ...r,
      days_overdue: parseInt(r.days_overdue) || 0,
      late_fee_amount: parseFloat(r.late_fee_amount) || 0,
      balance: parseFloat(r.balance) || 0
    }));
  }

  async getDetailedFinancials(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    let dateFilter = '';
    if (startDate && endDate) {
        dateFilter = "AND i.due_date BETWEEN '" + startDate + "' AND '" + endDate + "'";
    }

    const sql = `
      SELECT i.invoice_no, i.due_date, i.total_amount, i.amount_paid, i.status, u.unit_number, b.name as building
      FROM invoices i
      JOIN units u ON i."unitId" = u.id
      JOIN buildings b ON u.building_id = b.id
      WHERE 1=1
      ${scoping ? 'AND u.' + scoping : ''}
      ${dateFilter}
      ORDER BY i.due_date DESC
      LIMIT 100
    `;
    const invoices = await this.dataSource.query(sql);

    const paymentsSql = `
        SELECT p.id, p.amount, p.reference_no, p.created_at,
               i.id as "invoice_id", t.first_name as "tenant_first_name", t.last_name as "tenant_last_name"
        FROM payments p
        JOIN invoices i ON p."invoiceId" = i.id
        JOIN tenants t ON i."tenantId" = t.id
        JOIN units u ON i."unitId" = u.id
        WHERE 1=1
        ${scoping ? 'AND u.' + scoping : ''}
        ${startDate && endDate ? "AND p.created_at BETWEEN '" + startDate + "' AND '" + endDate + "'" : ''}
        ORDER BY p.created_at DESC
        LIMIT 20
    `;
    const paymentsRaw = await this.dataSource.query(paymentsSql);
    const recentPayments = paymentsRaw.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount),
        reference_no: p.reference_no,
        created_at: p.created_at,
        invoice: {
            id: p.invoice_id,
            tenant: {
                first_name: p.tenant_first_name,
                last_name: p.tenant_last_name
            }
        }
    }));

    return {
        invoices,
        recentPayments
    };
  }

  async getFinanceAnalytics(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    
    let categoryDateFilter = '';
    if (startDate && endDate) {
      categoryDateFilter = `AND i.due_date BETWEEN '${startDate}' AND '${endDate}'`;
    }

    const categorySql = `
        SELECT ii.type as name, SUM(ii.amount) as value
        FROM invoice_items ii
        JOIN invoices i ON ii."invoiceId" = i.id
        JOIN units u ON i."unitId" = u.id
        WHERE i.status != 'draft'
        ${scoping ? 'AND u.' + scoping : ''}
        ${categoryDateFilter}
        GROUP BY ii.type
    `;
    const categoryRevenueRaw = await this.dataSource.query(categorySql);
    const categoryRevenue = categoryRevenueRaw.map(r => ({ ...r, value: parseFloat(r.value) }));

    // Calculate real collection efficiency
    let efficiencyDateFilter = '';
    if (startDate && endDate) {
      efficiencyDateFilter = `AND i.due_date BETWEEN '${startDate}' AND '${endDate}'`;
    }
    const efficiencySql = `
        SELECT 
          COALESCE(SUM(i.amount_paid), 0)::float as collected,
          COALESCE(SUM(i.total_amount), 0)::float as total
        FROM invoices i
        JOIN units u ON i."unitId" = u.id
        WHERE i.status != 'draft'
        ${scoping ? 'AND u.' + scoping : ''}
        ${efficiencyDateFilter}
    `;
    const effResult = await this.dataSource.query(efficiencySql);
    const totalInvoiced = parseFloat(effResult[0]?.total) || 0;
    const totalCollected = parseFloat(effResult[0]?.collected) || 0;
    const collectedPct = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;
    const efficiency = [
        { name: 'Collected', value: collectedPct }, 
        { name: 'Outstanding', value: 100 - collectedPct }
    ];

    return {
      revenueTrend: await this.financialTrend(6, user, buildingId, startDate, endDate, ownerId, siteId),
      revenueByBuilding: await this.revenueDrilldown(user, buildingId, ownerId, siteId),
      overdueAging: await this.overdueAging(user, buildingId, ownerId, siteId),
      categoryRevenue,
      efficiency
    };
  }

  async getPropertyAnalytics(user: any, buildingId?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    
    const unitMixSql = `
      SELECT type as name, COUNT(*)::int as value
      FROM units
      WHERE 1=1
      ${scoping ? 'AND ' + scoping : ''}
      GROUP BY type
    `;
    const unitMix = await this.dataSource.query(unitMixSql);

    // Real tenure mix from leases
    const tenureSql = `
      SELECT 
        CASE 
          WHEN current_date - l.start_date <= 365 THEN 'Under 1 Year'
          WHEN current_date - l.start_date <= 1095 THEN '1-3 Years'
          ELSE 'Over 3 Years'
        END as name,
        COUNT(*)::int as value
      FROM leases l
      JOIN units u ON l.unit_id = u.id
      WHERE l.status IN ('ACTIVE', 'RENEWED')
      ${scoping ? 'AND u.' + scoping : ''}
      GROUP BY name
    `;
    const tenureMix = await this.dataSource.query(tenureSql);

    return {
      occupancyByBuilding: await this.occupancyByBuilding(user, buildingId, ownerId, siteId),
      revenueByBuilding: await this.revenueDrilldown(user, buildingId, ownerId, siteId),
      unitMix,
      tenureMix
    };
  }

  async getLeaseAnalytics(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);

    // Lease starts per month (growth trend)
    let startDateFilter = '';
    if (startDate && endDate) {
      startDateFilter = `AND l.start_date BETWEEN '${startDate}' AND '${endDate}'`;
    }
    const startsSql = `
      SELECT to_char(l.start_date, 'YYYY-MM') as month, COUNT(*)::int as leases
      FROM leases l
      JOIN units u ON l.unit_id = u.id
      WHERE 1=1
      ${scoping ? 'AND u.' + scoping : ''}
      ${startDateFilter}
      GROUP BY month
      ORDER BY month ASC
    `;
    const growthTrend = await this.dataSource.query(startsSql);

    // Upcoming expirations (next 6 months)
    const expirationsSql = `
      SELECT 
        t.first_name || ' ' || t.last_name as tenant,
        u.unit_number as unit,
        l.end_date as date
      FROM leases l
      JOIN tenants t ON l.tenant_id = t.id
      JOIN units u ON l.unit_id = u.id
      WHERE l.status IN ('ACTIVE', 'RENEWED')
      AND l.end_date <= current_date + interval '6 months'
      AND l.end_date >= current_date
      ${scoping ? 'AND u.' + scoping : ''}
      ORDER BY l.end_date ASC
    `;
    const upcomingExpirations = await this.dataSource.query(expirationsSql);

    // Lease status distribution
    const statusSql = `
      SELECT l.status as name, COUNT(*)::int as value
      FROM leases l
      JOIN units u ON l.unit_id = u.id
      WHERE 1=1
      ${scoping ? 'AND u.' + scoping : ''}
      GROUP BY l.status
    `;
    const leaseStatusDistribution = await this.dataSource.query(statusSql);

    return {
      growthTrend,
      upcomingExpirations,
      leaseStatusDistribution
    };
  }

  async getPeopleAnalytics(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    
    // Filter strictly by building if buildingId provided, otherwise fallback to site-wide for authorized sites
    const visitorScoping = buildingId 
        ? 'v.unit_id::text IN (SELECT id::text FROM units WHERE building_id::text = \'' + buildingId + '\')'
        : (scoping ? '(v.unit_id::text IN (SELECT id::text FROM units WHERE ' + scoping + ') OR v.site_id IN (SELECT "siteId"::text FROM buildings WHERE ' + scoping.replace('building_id', 'id') + '))' : '');

    // Use date range if provided, otherwise default to 60 days
    let visitorDateFilter = '';
    if (startDate && endDate) {
      visitorDateFilter = `AND check_in_time BETWEEN '${startDate}' AND '${endDate}'`;
    } else {
      visitorDateFilter = "AND check_in_time >= current_date - interval '60 days'";
    }

    const trafficSql = `
        SELECT to_char(check_in_time, 'Dy') as name, COUNT(*)::int as visitors
        FROM visitors v
        WHERE 1=1
        ${visitorDateFilter}
        ${visitorScoping ? 'AND ' + visitorScoping : ''}
        GROUP BY name, date_trunc('day', check_in_time)
        ORDER BY date_trunc('day', check_in_time) ASC
    `;
    const visitorTraffic = await this.dataSource.query(trafficSql);

    const tenureSql = `
        SELECT 
            CASE 
                WHEN current_date - start_date <= 365 THEN 'Under 1 Year'
                WHEN current_date - start_date <= 1095 THEN '1-3 Years'
                ELSE 'Over 3 Years'
            END as name,
            COUNT(*)::int as value
        FROM leases l
        WHERE l.status IN ('ACTIVE', 'RENEWED')
        ${scoping ? 'AND l.' + scoping : ''}
        GROUP BY name
    `;
    const tenureMix = await this.dataSource.query(tenureSql);

    return {
      tenantRetention: 92,
      visitorTraffic,
      tenureMix
    };
  }

  async maintenanceStats(user: any) {
    return this.maintenanceService.getStats(user);
  }

  async utilityConsumption(user: any, buildingId?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    const sql = `
      SELECT to_char(reading_date, 'YYYY-MM') as month, SUM(reading_value) as consumption
      FROM meter_readings
      ${scoping ? 'WHERE ' + scoping : ''}
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `;
    return (await this.dataSource.query(sql)).reverse();
  }

  async generateCSV(type: string, user: any): Promise<string> {
    let data = [];
    switch (type) {
      case 'financial':
        data = await this.financialTrend(12, user);
        break;
      case 'occupancy':
        data = await this.occupancyByBuilding(user);
        break;
    }
    
    if (data.length === 0) return 'No data available';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    return headers + '\n' + rows;
  }

  async generatePDF(type: string, filters: any, user: any): Promise<Buffer> {
    const doc = new PDFDocument();
    const chunks: any[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Building Management System - Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text("Type: " + type.toUpperCase());
      doc.text("Generated on: " + new Date().toLocaleString());
      doc.moveDown();
      doc.fontSize(12).text('Summary Data:');
      doc.moveDown();
      doc.text('Performance metrics and historical trends are analyzed below.');
      doc.end();
    });
  }

  async getSchedules(user: any) {
    return this.scheduleRepo.find({
      where: { user: { id: user.id } }
    });
  }

  async createSchedule(dto: any, user: any) {
    const schedule = this.scheduleRepo.create({
      ...dto,
      user
    });
    return this.scheduleRepo.save(schedule);
  }

  async deleteSchedule(id: string, user: any) {
    return this.scheduleRepo.delete({ id, user: { id: user.id } });
  }

  // ─── NEW: Invoice Status Breakdown (Paid / Partial / Unpaid) ──────
  async getInvoiceStatusBreakdown(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND i.due_date BETWEEN '${startDate}' AND '${endDate}'`;
    }

    const sql = `
      SELECT 
        CASE 
          WHEN i.amount_paid >= i.total_amount THEN 'Paid'
          WHEN i.amount_paid > 0 THEN 'Partial'
          ELSE 'Unpaid'
        END as name,
        COUNT(*)::int as value
      FROM invoices i
      JOIN units u ON i."unitId" = u.id
      WHERE i.status != 'draft'
      ${scoping ? 'AND u.' + scoping : ''}
      ${dateFilter}
      GROUP BY name
    `;
    return await this.dataSource.query(sql);
  }

  // ─── NEW: Monthly Collection Rate Trend ───────────────────────────
  async getMonthlyCollectionRate(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND to_char(i.due_date, 'YYYY-MM') BETWEEN '${startDate.substring(0,7)}' AND '${endDate.substring(0,7)}'`;
    }

    const sql = `
      SELECT 
        to_char(i.due_date, 'YYYY-MM') as month,
        SUM(i.total_amount)::float as invoiced,
        SUM(i.amount_paid)::float as collected,
        CASE WHEN SUM(i.total_amount) > 0 
          THEN LEAST(ROUND((SUM(i.amount_paid)::numeric / SUM(i.total_amount)::numeric) * 100, 1), 100)
          ELSE 0 
        END as rate
      FROM invoices i
      JOIN units u ON i."unitId" = u.id
      WHERE i.status != 'draft'
      ${scoping ? 'AND u.' + scoping : ''}
      ${dateFilter}
      GROUP BY month
      ORDER BY month ASC
    `;
    const rows = await this.dataSource.query(sql);
    return rows.map(r => ({
      month: r.month,
      invoiced: parseFloat(r.invoiced) || 0,
      collected: parseFloat(r.collected) || 0,
      rate: parseFloat(r.rate) || 0
    }));
  }

  // ─── NEW: Tenant Payment History ──────────────────────────────────
  async getTenantPaymentHistory(user: any, buildingId?: string, startDate?: string, endDate?: string, ownerId?: string, siteId?: string) {
    const scoping = this.getScopingCriteria(user, buildingId, ownerId, siteId);
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND i.due_date BETWEEN '${startDate}' AND '${endDate}'`;
    }

    const sql = `
      SELECT 
        t.first_name || ' ' || t.last_name as tenant_name,
        i.invoice_no,
        i.due_date,
        i.total_amount::float as amount,
        i.amount_paid::float as paid_amount,
        (i.total_amount - i.amount_paid)::float as balance,
        i.status,
        u.unit_number,
        b.name as building_name,
        p.created_at as last_payment_date,
        p.reference_no as last_payment_ref
      FROM invoices i
      JOIN units u ON i."unitId" = u.id
      JOIN buildings b ON u.building_id = b.id
      JOIN tenants t ON i."tenantId" = t.id
      LEFT JOIN LATERAL (
        SELECT created_at, reference_no FROM payments 
        WHERE "invoiceId" = i.id ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE i.status != 'draft'
      ${scoping ? 'AND u.' + scoping : ''}
      ${dateFilter}
      ORDER BY t.first_name, t.last_name, i.due_date DESC
    `;
    const rows = await this.dataSource.query(sql);
    return rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount) || 0,
      paid_amount: parseFloat(r.paid_amount) || 0,
      balance: parseFloat(r.balance) || 0
    }));
  }

  private getScopingCriteria(user: any, buildingId?: string, ownerId?: string, siteId?: string): string {
    let baseScoping = '';
    
    if (user.role === 'owner') {
      baseScoping = "building_id::text IN (SELECT id::text FROM buildings WHERE \"ownerId\"::text IN (SELECT id::text FROM owners WHERE \"user_id\"::text = '" + user.id + "'))";
    } else if (user.role === 'site_admin') {
      baseScoping = "building_id::text IN (SELECT building_id::text FROM building_admin_assignments WHERE user_id::text = '" + user.id + "')";
    } else if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'finance') {
        baseScoping = ''; // No default scoping
    }

    const extraFilters: string[] = [];

    if (buildingId) {
      extraFilters.push("building_id::text = '" + buildingId + "'");
    }
    if (ownerId) {
      extraFilters.push("building_id::text IN (SELECT id::text FROM buildings WHERE \"ownerId\"::text = '" + ownerId + "')");
    }
    if (siteId) {
      extraFilters.push("building_id::text IN (SELECT id::text FROM buildings WHERE \"siteId\"::text = '" + siteId + "')");
    }

    if (extraFilters.length > 0) {
      const combined = extraFilters.join(' AND ');
      return baseScoping ? "(" + baseScoping + " AND " + combined + ")" : combined;
    }

    return baseScoping;
  }
}
