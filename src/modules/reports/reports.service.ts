import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from '../units/entities/unit.entity';
import { Lease, LeaseStatus } from '../leases/entities/lease.entity';
import { LeasePayment } from '../leases/entities/lease-payment.entity';
import { MaintenanceService } from '../maintenance/maintenance.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
    @InjectRepository(LeasePayment)
    private readonly paymentRepo: Repository<LeasePayment>,
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
}
