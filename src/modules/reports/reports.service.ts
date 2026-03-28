import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Unit } from '../units/entities/unit.entity';
import { Lease, LeaseStatus } from '../leases/entities/lease.entity';
import { LeasePayment } from '../leases/entities/lease-payment.entity';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { Invoice, InvoiceStatus } from '../finance/entities/invoice.entity';
import { Building } from '../buildings/entities/building.entity';
import { Site } from '../sites/entities/site.entity';
import { MeterReading } from '../utility/entities/meter-reading.entity';
import { Between } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
    @InjectRepository(LeasePayment)
    private readonly paymentRepo: Repository<LeasePayment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Building)
    private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(MeterReading)
    private readonly readingRepo: Repository<MeterReading>,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  async dashboard() {
    // Occupancy rate
    const totalUnits = await this.unitRepo.count();
    const occupiedLeases = await this.leaseRepo.count({
      where: { status: LeaseStatus.ACTIVE },
    });
    const occupancy =
      totalUnits === 0 ? 0 : (occupiedLeases / totalUnits) * 100;

    // Revenue: sum of paid payments
    const revenueResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount),0)', 'total')
      .where('p.status = :status', { status: 'paid' })
      .getRawOne();

    const totalRevenue = Number(revenueResult.total || 0);

    // Maintenance KPIs: delegate to maintenance service if available
    let maintenanceKpis = { avgResolutionTime: 0, contractorStats: [] } as any;
    try {
      maintenanceKpis = await this.maintenanceService.getDashboardKpis();
    } catch (e) {
      // ignore if maintenance service not available
    }

    return {
      occupancy_rate: occupancy,
      total_units: totalUnits,
      occupied_leases: occupiedLeases,
      total_revenue: totalRevenue,
      maintenance: maintenanceKpis,
    };
  }

  async financialTrend(months = 6) {
    // Returns monthly sums for the past N months
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .select("to_char(p.created_at, 'YYYY-MM')", 'month')
      .addSelect('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: 'paid' })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .limit(months);

    const rows = await qb.getRawMany();
    return rows.map((r) => ({ month: r.month, total: Number(r.total) }));
  }

  async occupancyInsights() {
    // Vacant units and leases expiring soon
    const vacant = await this.unitRepo.count({
      where: { status: 'vacant' } as any,
    });
    const expiring = await this.leaseRepo
      .createQueryBuilder('l')
      .where('l.end_date BETWEEN :start AND :end', {
        start: new Date().toISOString().split('T')[0],
        end: new Date(new Date().setDate(new Date().getDate() + 30))
          .toISOString()
          .split('T')[0],
      })
      .andWhere('l.status = :status', { status: LeaseStatus.ACTIVE })
      .getCount();

    return { vacant_units: vacant, expiring_soon: expiring };
  }

  async revenueDrilldown() {
    // Group revenue by Building
    return this.paymentRepo
      .createQueryBuilder('p')
      .select('b.name', 'building')
      .addSelect('SUM(p.amount)', 'total')
      .innerJoin('p.lease', 'l')
      .innerJoin('l.unit', 'u')
      .innerJoin('u.building', 'b')
      .where('p.status = :status', { status: 'paid' })
      .groupBy('b.name')
      .getRawMany();
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

  async overdueAging() {
    const now = new Date();
    const day30 = new Date(new Date().setDate(now.getDate() - 30));
    const day60 = new Date(new Date().setDate(now.getDate() - 60));
    const day90 = new Date(new Date().setDate(now.getDate() - 90));

    const invoices = await this.invoiceRepo.find({
      where: { status: InvoiceStatus.OVERDUE },
    });

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

  async generateCSV(type: string) {
    let data: any[] = [];
    if (type === 'revenue') data = await this.revenueDrilldown();
    else if (type === 'overdue') {
      const aging = await this.overdueAging();
      data = [aging];
    }
    
    if (data.length === 0) return 'No data';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
    return `${headers}\n${rows}`;
  }
}
