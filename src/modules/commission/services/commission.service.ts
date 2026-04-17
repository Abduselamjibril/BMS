import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Commission, CommissionStatus } from '../entities/commission.entity';
import { CommissionRule } from '../entities/commission-rule.entity';
import { CommissionPayment } from '../entities/commission-payment.entity';
import { CommissionPaymentItem } from '../entities/commission-payment-item.entity';

@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(Commission)
    private readonly commissionRepo: Repository<Commission>,
    @InjectRepository(CommissionRule)
    private readonly ruleRepo: Repository<CommissionRule>,
    @InjectRepository(CommissionPayment)
    private readonly paymentRepo: Repository<CommissionPayment>,
    @InjectRepository(CommissionPaymentItem)
    private readonly paymentItemRepo: Repository<CommissionPaymentItem>,
    private readonly dataSource: DataSource,
  ) {}

  async getCommissions(filters: any) {
    const qb = this.commissionRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.nominee', 'nominee')
      .leftJoinAndSelect('c.building', 'building');

    if (filters.status) qb.andWhere('c.status = :status', { status: filters.status });
    if (filters.nominee_id) qb.andWhere('c.nominee_id = :nominee_id', { nominee_id: filters.nominee_id });

    return qb.orderBy('c.calculated_at', 'DESC').getMany();
  }

  async getRules() {
    return this.ruleRepo.find({ relations: ['nominee', 'building'] });
  }

  async createRule(dto: any) {
    const rule = this.ruleRepo.create(dto);
    return this.ruleRepo.save(rule);
  }

  async approveCommission(id: string) {
    const commission = await this.commissionRepo.findOne({ where: { id } });
    if (!commission) throw new NotFoundException('Commission not found');
    commission.status = CommissionStatus.APPROVED;
    return this.commissionRepo.save(commission);
  }

  async createPayment(dto: { commission_ids: string[]; reference_no: string; payment_date: string }) {
    const commissions = await this.commissionRepo.find({
      where: { id: In(dto.commission_ids), status: CommissionStatus.APPROVED },
    });

    if (commissions.length === 0) {
      throw new Error('No approved commissions found for the provided IDs');
    }

    const nomineeId = commissions[0].nominee_id;
    const sameNominee = commissions.every(c => c.nominee_id === nomineeId);
    if (!sameNominee) {
      throw new Error('All commissions in a single payment must belong to the same nominee');
    }

    const totalAmount = commissions.reduce((sum, c) => sum + Number(c.amount), 0);

    return this.dataSource.transaction(async (manager) => {
      const payment = manager.getRepository(CommissionPayment).create({
        nominee_id: nomineeId,
        total_amount: totalAmount,
        reference_no: dto.reference_no,
        payment_date: dto.payment_date,
        status: 'PAID' as any,
      });

      const savedPayment = await manager.save(payment);

      for (const commission of commissions) {
        // Create join item
        const item = manager.getRepository(CommissionPaymentItem).create({
          payment: savedPayment,
          commission: commission,
        });
        await manager.save(item);

        // Update commission status
        commission.status = CommissionStatus.PAID;
        await manager.save(commission);
      }

      return savedPayment;
    });
  }

  async getPayments() {
    return this.paymentRepo.find({ relations: ['nominee', 'items', 'items.commission'] });
  }
}
