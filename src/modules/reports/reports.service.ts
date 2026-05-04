import { Injectable } from '@nestjs/common';
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

@Injectable()
export class ReportsService {
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
    private readonly maintenanceService: MaintenanceService,
  ) {}

  private async getScopingCriteria(user: any) {
    if (!user) return null;
    
    // Super Admin and Admin can see everything
    const roles = user.roles || [];
    if (roles.includes('super_admin') || roles.includes('admin')) {
      return null;
    }

    // Get buildings assigned via site management
    const managedSites = await this.siteRepo.find({
      where: { manager_id: user.id },
      relations: ['buildings'],
    });
    const siteBuildingIds = managedSites.flatMap(s => s.buildings?.map(b => b.id) || []);

    // Get buildings explicitly assigned to the user
    const assignments = await this.adminRepo.find({
      where: { user: { id: user.id }, status: 'active' },
      relations: ['building'],
    });
    const directBuildingIds = assignments.map(a => a.building?.id);

    const allBuildingIds = [...new Set([...siteBuildingIds, ...directBuildingIds])].filter(Boolean);
    
    // If user is a site_admin, prioritize the site assignment. 
    // If they manage NO site but HAVE the site_admin role, they should see NOTHING.
    if (roles.includes('site_admin')) {
        return siteBuildingIds.length > 0 ? siteBuildingIds : ['00000000-0000-0000-0000-000000000000'];
    }

    return allBuildingIds.length > 0 ? allBuildingIds : ['00000000-0000-0000-0000-000000000000']; // Return dummy if none to ensure empty result
  }

  async getPeopleReport(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    
    const tenantWhere: any = {};
    const visitorWhere: any = {};
    
    if (buildingIds) {
       tenantWhere.building = In(buildingIds);
       visitorWhere.building = In(buildingIds);
    }

    const tenants = await this.tenantRepo.find({
      where: tenantWhere,
      relations: ['user'],
      take: 50,
    });
    const visitors = await this.visitorRepo.find({
      where: visitorWhere,
      order: { check_in_time: 'DESC' },
      take: 50,
    });
    return { tenants, visitors };
  }

  async getLeaseReport(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    const where: any = {};
    if (buildingIds) {
      where.unit = { building: { id: In(buildingIds) } };
    }

    return this.leaseRepo.find({
      where,
      relations: ['unit', 'unit.building', 'tenant'],
      order: { start_date: 'DESC' },
      take: 100,
    });
  }

  async getPropertyReport(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    const where: any = {};
    if (buildingIds) {
      where.id = In(buildingIds);
    }

    const buildings = await this.buildingRepo.find({
      where,
      relations: ['units'],
    });
    
    return buildings.map(b => {
      const totalUnits = b.units?.length || 0;
      const occupiedUnits = b.units?.filter(u => u.status === UnitStatus.OCCUPIED).length || 0;
      return {
        id: b.id,
        name: b.name,
        total_units: totalUnits,
        occupied_units: occupiedUnits,
        occupancy_rate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
      };
    });
  }

  async getOverduePenaltyReport(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    const where: any = { status: In([InvoiceStatus.OVERDUE, InvoiceStatus.PARTIAL]) };
    if (buildingIds) {
      where.unit = { building: { id: In(buildingIds) } };
    }

    const overdueInvoices = await this.invoiceRepo.find({
      where,
      relations: ['tenant', 'unit', 'lease'],
    });

    const now = new Date();
    
    return overdueInvoices.map(inv => {
      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      return {
        invoice_no: inv.invoice_no,
        tenant_name: inv.tenant ? `${inv.tenant.first_name} ${inv.tenant.last_name}` : 'N/A',
        unit_name: inv.unit?.unit_number || 'N/A',
        due_date: inv.due_date,
        days_overdue: daysOverdue,
        total_amount: inv.total_amount,
        amount_paid: inv.amount_paid,
        balance: Number(inv.total_amount) - Number(inv.amount_paid),
        late_fee_amount: inv.late_fee_amount,
        // Assuming settings could be fetched here if needed, but for now we show what's recorded
      };
    });
  }

  async getDetailedFinancials(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    const invoiceWhere: any = {};
    const paymentWhere: any = {};
    
    if (buildingIds) {
      invoiceWhere.unit = { building: { id: In(buildingIds) } };
      paymentWhere.invoice = { unit: { building: { id: In(buildingIds) } } };
    }

    const recentInvoices = await this.invoiceRepo.find({
      where: invoiceWhere,
      order: { due_date: 'DESC' } as any,
      take: 20,
      relations: ['tenant'],
    });
    
    const recentPayments = await this.paymentRepo.find({
      where: paymentWhere,
      order: { created_at: 'DESC' },
      take: 20,
      relations: ['invoice', 'invoice.tenant'],
    });

    return { recentInvoices, recentPayments };
  }

  async dashboard(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    const where: any = {};
    if (buildingIds) {
      where.building = { id: In(buildingIds) };
    }

    // Occupancy rate
    const totalUnits = await this.unitRepo.count({ where });
    const occupiedUnits = await this.unitRepo.count({
      where: { ...where, status: UnitStatus.OCCUPIED },
    });
    const occupiedLeases = await this.leaseRepo.count({
      where: { unit: (where.building && buildingIds) ? { building: { id: In(buildingIds) } } : {}, status: LeaseStatus.ACTIVE },
    });
    const occupancy =
      totalUnits === 0 ? 0 : (occupiedUnits / totalUnits) * 100;

    // Revenue: sum of paid payments
    const revenueQb = this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount),0)', 'total')
      .where('p.status = :status', { status: 'confirmed' });
    
    if (buildingIds) {
      revenueQb.innerJoin('p.invoice', 'i')
               .innerJoin('i.unit', 'u')
               .andWhere('u.building_id IN (:...ids)', { ids: buildingIds });
    }
    const revenueResult = await revenueQb.getRawOne();

    const totalRevenue = Number(revenueResult.total || 0);

    // Maintenance KPIs: delegate to maintenance service if available
    let maintenanceKpis = { avgResolutionTime: 0, contractorStats: [] } as any;
    try {
      maintenanceKpis = await this.maintenanceService.getDashboardKpis(buildingIds || undefined);
    } catch (e) {
      // ignore if maintenance service not available
    }

    return {
      occupancy_rate: occupancy,
      total_units: totalUnits,
      occupied_units: occupiedUnits,
      occupied_leases: occupiedLeases,
      total_revenue: totalRevenue,
      maintenance: maintenanceKpis,
      pending_maintenance_count: maintenanceKpis.pendingRequestsCount || 0,
    };
  }

  async financialTrend(months = 12, user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    // Returns monthly sums for the past N months
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .select("to_char(p.created_at, 'YYYY-MM')", 'month')
      .addSelect('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: 'confirmed' });

    if (buildingIds) {
       qb.innerJoin('p.invoice', 'i')
         .innerJoin('i.unit', 'u')
         .andWhere('u.building_id IN (:...ids)', { ids: buildingIds });
    }
    
    qb.groupBy('month')
      .orderBy('month', 'ASC')
      .limit(months);

    const rows = await qb.getRawMany();
    return rows.map((r) => ({ month: r.month, total: Number(r.total) }));
  }

  async occupancyInsights(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    const where: any = {};
    if (buildingIds) {
      where.building = { id: In(buildingIds) };
    }

    // Vacant units and leases expiring soon
    const totalUnits = await this.unitRepo.count({ where });
    const occupiedUnits = await this.unitRepo.count({
      where: { ...where, status: UnitStatus.OCCUPIED },
    });
    const vacant = totalUnits - occupiedUnits;

    const expiryQb = this.leaseRepo.createQueryBuilder('l');
    if (buildingIds) {
       expiryQb.innerJoin('l.unit', 'u')
               .where('u.building_id IN (:...ids)', { ids: buildingIds });
    }

    const expiring = await expiryQb
      .andWhere('l.end_date BETWEEN :start AND :end', {
        start: new Date().toISOString().split('T')[0],
        end: new Date(new Date().setDate(new Date().getDate() + 30))
          .toISOString()
          .split('T')[0],
      })
      .andWhere('l.status = :status', { status: LeaseStatus.ACTIVE })
      .getCount();

    return { vacant_units: vacant, expiring_soon: expiring };
  }

  async revenueDrilldown(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    // Group revenue by Building
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .select('b.name', 'building')
      .addSelect('SUM(p.amount)', 'total')
      .innerJoin('p.invoice', 'i')
      .innerJoin('i.lease', 'l')
      .innerJoin('l.unit', 'u')
      .innerJoin('u.building', 'b')
      .where('p.status = :status', { status: 'confirmed' });

    if (buildingIds) {
      qb.andWhere('b.id IN (:...ids)', { ids: buildingIds });
    }

    return qb.groupBy('b.name').getRawMany();
  }

  async vacancyTrend() {
    // Mocking a 12-month vacancy trend for visualization
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, i) => ({
      month: m,
      vacant: Math.floor(Math.random() * 10) + 2,
      occupied: Math.floor(Math.random() * 50) + 80,
    }));
  }

  async overdueAging(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    const where: any = { status: InvoiceStatus.OVERDUE };
    if (buildingIds) {
      where.unit = { building: { id: In(buildingIds) } };
    }

    const invoices = await this.invoiceRepo.find({
      where,
    });

    const now = new Date();
    const day30 = new Date(new Date().setDate(now.getDate() - 30));
    const day60 = new Date(new Date().setDate(now.getDate() - 60));
    const day90 = new Date(new Date().setDate(now.getDate() - 90));

    const report = {
      current: 0,
      '30_days': 0,
      '60_days': 0,
      '90_plus': 0,
    };

    invoices.forEach((inv) => {
      const due = new Date(inv.due_date);
      const amount = Number(inv.total_amount);
      if (due > day30) report.current += amount;
      else if (due > day60) report['30_days'] += amount;
      else if (due > day90) report['60_days'] += amount;
      else report['90_plus'] += amount;
    });

    return report;
  }

  async maintenanceCostAnalytics() {
    // Simplified maintenance cost aggregation
    try {
      const kpis = await this.maintenanceService.getDashboardKpis();
      return kpis.monthlyTrends || [];
    } catch (e) {
      return [];
    }
  }

  async getTurnoverRate() {
    const totalTenants = await this.leaseRepo.count({ where: { status: LeaseStatus.ACTIVE } });
    const departures = await this.leaseRepo.count({
      where: { status: 'TERMINATED' as any },
    });
    
    return {
      turnover_rate: totalTenants > 0 ? (departures / totalTenants) * 100 : 0,
      departures,
      active_count: totalTenants
    };
  }

  async getAverageTenancy() {
    const expiredLeases = await this.leaseRepo.find({
      where: { status: In([LeaseStatus.EXPIRED, 'TERMINATED' as any]) },
    });
    
    if (expiredLeases.length === 0) return { avg_days: 0 };
    
    const totalDays = expiredLeases.reduce((acc, l) => {
      const start = new Date(l.start_date).getTime();
      const end = new Date(l.end_date).getTime();
      return acc + (end - start) / (1000 * 60 * 60 * 24);
    }, 0);
    
    return { avg_days: Math.round(totalDays / expiredLeases.length) };
  }

  async getUtilityAnomalies() {
    // Flag any reading > 50% above unit average
    const anomalies = await this.readingRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.meter', 'm')
      .leftJoinAndSelect('m.unit', 'u')
      .where('r.reading_value > (SELECT AVG(inner_r.reading_value) * 1.5 FROM meter_readings inner_r WHERE inner_r.meter_id = r.meter_id)')
      .getMany();
    
    return anomalies;
  }

  async getUtilityAnalytics() {
    const readings = await this.readingRepo
      .createQueryBuilder('r')
      .select("to_char(r.reading_date, 'Mon')", 'month')
      .addSelect('SUM(r.reading_value)', 'consumption')
      .groupBy('month')
      .getRawMany();
    
    return readings.map(r => ({ month: r.month, consumption: Number(r.consumption) }));
  }

  async generateCSV(type: string, user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    const where: any = {};
    if (buildingIds) {
      where.id = In(buildingIds);
    }

    let rawData: any[] = [];
    
    // 1. Fetch Data based on type
    if (type === 'buildings') {
      rawData = await this.buildingRepo.find({ where, relations: ['site'] });
    } else if (type === 'units') {
      const unitWhere: any = buildingIds ? { building: { id: In(buildingIds) } } : {};
      rawData = await this.unitRepo.find({ where: unitWhere, relations: ['building'] });
    } else if (type === 'tenants') {
      const tenantWhere: any = buildingIds ? { building: { id: In(buildingIds) } } : {};
      rawData = await this.tenantRepo.find({ where: tenantWhere, relations: ['user'] });
    } else if (type === 'leases') {
      const leaseWhere: any = buildingIds ? { unit: { building: { id: In(buildingIds) } } } : {};
      rawData = await this.leaseRepo.find({ where: leaseWhere, relations: ['unit', 'tenant'] });
    } else if (type === 'payments') {
      const payWhere: any = buildingIds ? { invoice: { unit: { building: { id: In(buildingIds) } } } } : {};
      rawData = await this.paymentRepo.find({ where: payWhere, relations: ['invoice', 'invoice.tenant'] });
    } else if (type === 'invoices') {
      const invWhere: any = buildingIds ? { unit: { building: { id: In(buildingIds) } } } : {};
      rawData = await this.invoiceRepo.find({ where: invWhere, relations: ['tenant'] });
    } else if (type === 'visitors') {
      const visWhere: any = buildingIds ? { building: { id: In(buildingIds) } } : {};
      rawData = await this.visitorRepo.find({ where: visWhere });
    } else if (type === 'revenue') {
      rawData = await this.revenueDrilldown(user);
    } else if (type === 'overdue') {
      rawData = await this.getOverduePenaltyReport(user);
    }

    if (!rawData || rawData.length === 0) return 'No data available for export';

    // 2. Flatten and Dynamic Header Generation
    const flattened = rawData.map(item => this.flattenData(item, type));
    if (flattened.length === 0) return 'No data available for export';
    
    const headersList = Object.keys(flattened[0]);
    const headers = headersList.join(',');
    
    const rows = flattened.map(itemObj => 
      headersList.map(header => {
        let val = itemObj[header];
        
        // Final safety check for Rent column
        if (header === 'Rent' && (val === null || val === undefined || val === '')) {
          val = 0;
        }
        
        const str = String(val ?? '');
        return str.includes(',') ? `"${str}"` : str;
      }).join(',')
    ).join('\n');

    return `${headers}\n${rows}`;
  }

  private flattenData(obj: any, type: string): any {
    const flat: any = {};
    
    if (type === 'buildings') {
      flat['ID'] = obj.id;
      flat['Name'] = obj.name;
      flat['Code'] = obj.code;
      flat['Address'] = obj.address;
      flat['Site'] = obj.site?.name || 'N/A';
      flat['Total Units'] = obj.total_units || 0;
    } else if (type === 'units') {
      flat['ID'] = obj.id;
      // Handle both raw query result (building_name) and entity result (building.name)
      flat['Building'] = obj.building_name || obj.building?.name || 'N/A';
      flat['Unit Number'] = obj.unit_number;
      flat['Floor'] = obj.floor;
      flat['Type'] = obj.type;
      flat['Status'] = obj.status;
      flat['Rent'] = obj.rent_price || obj.rent || 0;
    } else if (type === 'tenants') {
      flat['ID'] = obj.id;
      flat['First Name'] = obj.first_name;
      flat['Last Name'] = obj.last_name;
      flat['Email'] = obj.email;
      flat['Phone'] = obj.phone_number;
      flat['Status'] = obj.is_active ? 'Active' : 'Inactive';
    } else if (type === 'leases') {
      flat['ID'] = obj.id;
      flat['Tenant'] = obj.tenant ? `${obj.tenant.first_name} ${obj.tenant.last_name}` : 'N/A';
      flat['Unit'] = obj.unit?.unit_number || 'N/A';
      flat['Start Date'] = obj.start_date;
      flat['End Date'] = obj.end_date;
      flat['Rent'] = obj.rent_amount || obj.rent || obj.rent_price || 0;
      flat['Status'] = obj.status;
    } else if (type === 'payments') {
      flat['ID'] = obj.id;
      flat['Tenant'] = obj.invoice?.tenant ? `${obj.invoice.tenant.first_name} ${obj.invoice.tenant.last_name}` : 'N/A';
      flat['Reference'] = obj.reference_no;
      flat['Method'] = obj.payment_method;
      flat['Amount'] = obj.amount;
      flat['Date'] = obj.created_at;
      flat['Status'] = obj.status;
    } else if (type === 'invoices') {
      flat['Invoice No'] = obj.invoice_no;
      flat['Tenant'] = obj.tenant ? `${obj.tenant.first_name} ${obj.tenant.last_name}` : 'N/A';
      flat['Due Date'] = obj.due_date;
      flat['Subtotal'] = obj.subtotal;
      flat['Tax'] = obj.tax_amount;
      flat['Total'] = obj.total_amount;
      flat['Status'] = obj.status;
    } else if (type === 'visitors') {
      flat['ID'] = obj.id;
      flat['Name'] = obj.visitor_name;
      flat['Purpose'] = obj.purpose;
      flat['Check-In'] = obj.check_in_time;
      flat['Check-Out'] = obj.check_out_time;
    } else {
      // Fallback for simple objects
      return obj;
    }
    
    return flat;
  }

  // --- ADVANCED ANALYTICS FOR GRAPHS ---

  async getFinanceAnalytics(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    // 1. Revenue by Category (Rent, Utility, etc.)
    const categoryQb = this.invoiceItemRepo
      .createQueryBuilder('ii')
      .select('ii.type', 'category')
      .addSelect('SUM(ii.amount)', 'total')
      .innerJoin('ii.invoice', 'i')
      .groupBy('ii.type');

    if (buildingIds) {
       categoryQb.andWhere('i.unitId IN (SELECT id FROM units WHERE building_id IN (:...ids))', { ids: buildingIds });
    }
    const categoryRevenue = await categoryQb.getRawMany();

    // 2. Collection Efficiency (Invoiced vs Paid)
    const invoicedQb = this.invoiceRepo
      .createQueryBuilder('i')
      .select('SUM(i.total_amount)', 'total')
      .where('i.status != :status', { status: InvoiceStatus.DRAFT });
    
    const paidQb = this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: 'confirmed' });

    if (buildingIds) {
       invoicedQb.andWhere('i.unitId IN (SELECT id FROM units WHERE building_id IN (:...ids))', { ids: buildingIds });
       paidQb.innerJoin('p.invoice', 'inv')
             .innerJoin('inv.unit', 'u')
             .andWhere('u.building_id IN (:...ids)', { ids: buildingIds });
    }

    const totalInvoiced = await invoicedQb.getRawOne();
    const totalPaid = await paidQb.getRawOne();

    return {
      categoryRevenue: categoryRevenue.map(r => ({ name: r.category, value: Number(r.total) })),
      efficiency: [
        { name: 'Paid', value: Number(totalPaid?.total || 0) },
        { name: 'Outstanding', value: Math.max(0, Number(totalInvoiced?.total || 0) - Number(totalPaid?.total || 0)) },
      ]
    };
  }

  async getPropertyAnalytics(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    // 1. Occupancy mix by Unit Type
    const qb = this.unitRepo
      .createQueryBuilder('u')
      .select('u.type', 'type')
      .addSelect('COUNT(*)', 'count');

    if (buildingIds) {
      qb.where('u.building_id IN (:...ids)', { ids: buildingIds });
    }

    const typeDistribution = await qb.groupBy('u.type').getRawMany();

    // 2. Building Performance Comparison
    const buildingPerformance = await this.getPropertyReport(user);

    return {
      unitMix: typeDistribution.map(d => ({ name: d.type, value: parseInt(d.count) })),
      buildingPerformance
    };
  }

  async getLeaseAnalytics(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    // 1. Lease Activity (Starts per month)
    const qb = this.leaseRepo
      .createQueryBuilder('l')
      .select("to_char(l.start_date, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count');

    if (buildingIds) {
      qb.innerJoin('l.unit', 'u')
        .where('u.building_id IN (:...ids)', { ids: buildingIds });
    }

    const starts = await qb.groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // 2. Expiration Forecast (Next 6 months)
    const today = new Date();
    const sixMonthsLater = new Date(new Date().setMonth(today.getMonth() + 6));
    
    const leaseWhere: any = {
      end_date: Between(today.toISOString().split('T')[0], sixMonthsLater.toISOString().split('T')[0]),
      status: LeaseStatus.ACTIVE
    };

    if (buildingIds) {
      leaseWhere.unit = { building: { id: In(buildingIds) } };
    }

    const expirations = await this.leaseRepo.find({
        where: leaseWhere,
        relations: ['unit', 'tenant']
      });

    return {
      growthTrend: starts.map(s => ({ month: s.month, leases: parseInt(s.count) })),
      expirationsCount: expirations.length,
      upcomingExpirations: expirations.map(e => ({
        tenant: e.tenant?.first_name + ' ' + e.tenant?.last_name,
        unit: e.unit?.unit_number,
        date: e.end_date
      }))
    };
  }

  async getPeopleAnalytics(user?: any) {
    const buildingIds = await this.getScopingCriteria(user);
    // 1. Visitor Traffic by Weekday
    const qb = this.visitorRepo
      .createQueryBuilder('v')
      .select("to_char(v.check_in_time, 'Day')", 'day')
      .addSelect('COUNT(*)', 'count');

    if (buildingIds) {
      qb.where('v.building_id IN (:...ids)', { ids: buildingIds });
    }

    const traffic = await qb.groupBy('day').getRawMany();

    // 2. Tenant Tenure length distribution
    const leaseWhere: any = { status: LeaseStatus.ACTIVE };
    if (buildingIds) {
       leaseWhere.unit = { building: { id: In(buildingIds) } };
    }
    const activeLeases = await this.leaseRepo.find({ where: leaseWhere });
    const demographics = {
      'New (< 6M)': 0,
      'Stable (6M-1Y)': 0,
      'Loyal (> 1Y)': 0
    };

    const now = new Date().getTime();
    activeLeases.forEach(l => {
      const start = new Date(l.start_date).getTime();
      const months = (now - start) / (1000 * 60 * 60 * 24 * 30.44);
      if (months < 6) demographics['New (< 6M)']++;
      else if (months < 12) demographics['Stable (6M-1Y)']++;
      else demographics['Loyal (> 1Y)']++;
    });

    return {
      visitorTraffic: traffic.map(t => ({ name: t.day.trim(), visitors: parseInt(t.count) })),
      tenureMix: Object.entries(demographics).map(([name, value]) => ({ name, value }))
    };
  }
}
