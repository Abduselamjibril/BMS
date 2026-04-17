import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionRule, CommissionType, CommissionBasis } from '../entities/commission-rule.entity';
import { Commission, CommissionStatus } from '../entities/commission.entity';

@Injectable()
export class CommissionCalculationService {
  private readonly logger = new Logger(CommissionCalculationService.name);

  constructor(
    @InjectRepository(CommissionRule)
    private readonly ruleRepo: Repository<CommissionRule>,
    @InjectRepository(Commission)
    private readonly commissionRepo: Repository<Commission>,
  ) {}

  /**
   * Main entry point for triggering commission calculations from external modules.
   */
  async calculateFromSource(
    basis: CommissionBasis,
    sourceId: string,
    amount: number,
    nomineeId?: string,
    buildingId?: string,
  ) {
    this.logger.log(`Calculating commission for basis ${basis}, source ${sourceId}, amount ${amount}`);

    // Fetch active rules that match the criteria
    const query = this.ruleRepo.createQueryBuilder('rule')
      .where('rule.is_active = true')
      .andWhere('rule.basis = :basis', { basis });

    if (nomineeId) {
      query.andWhere('rule.nominee_id = :nomineeId', { nomineeId });
    }
    
    // We check for rules that apply to this building OR general rules for the nominee
    if (buildingId) {
      query.andWhere('(rule.building_id = :buildingId OR rule.building_id IS NULL)', { buildingId });
    } else {
      query.andWhere('rule.building_id IS NULL');
    }

    const rules = await query.getMany();

    if (rules.length === 0) {
      this.logger.debug('No active commission rules found for this transaction.');
      return [];
    }

    const createdCommissions: Commission[] = [];

    for (const rule of rules) {
      let commissionAmount = 0;

      if (rule.type === CommissionType.PERCENTAGE) {
        commissionAmount = (amount * rule.rate) / 100;
      } else {
        commissionAmount = Number(rule.rate);
      }

      const commission = this.commissionRepo.create({
        nominee_id: rule.nominee_id,
        building_id: buildingId || rule.building_id,
        source_type: basis.toString(),
        source_id: sourceId,
        amount: commissionAmount,
        amount_base: amount,
        status: CommissionStatus.PENDING,
      });

      createdCommissions.push(await this.commissionRepo.save(commission));
    }

    return createdCommissions;
  }
}
