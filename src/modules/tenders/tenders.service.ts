import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LeaseTender, TenderStatus } from './entities/lease-tender.entity';
import { TenderBid, BidStatus } from './entities/tender-bid.entity';
import { LeasesService } from '../leases/leases.service';

@Injectable()
export class TendersService {
  constructor(
    @InjectRepository(LeaseTender)
    private readonly tenderRepo: Repository<LeaseTender>,
    @InjectRepository(TenderBid)
    private readonly bidRepo: Repository<TenderBid>,
    private readonly leasesService: LeasesService,
    private readonly dataSource: DataSource,
  ) {}

  async createTender(dto: any) {
    const tender = this.tenderRepo.create(dto);
    return this.tenderRepo.save(tender);
  }

  async getTenders(filters: any = {}) {
    const qb = this.tenderRepo.createQueryBuilder('tender')
      .leftJoinAndSelect('tender.building', 'building')
      .leftJoinAndSelect('tender.unit', 'unit')
      .leftJoinAndSelect('tender.bids', 'bids');

    if (filters.status) qb.andWhere('tender.status = :status', { status: filters.status });
    if (filters.building_id) qb.andWhere('tender.building_id = :building_id', { building_id: filters.building_id });

    return qb.orderBy('tender.created_at', 'DESC').getMany();
  }

  async getTender(id: string) {
    const tender = await this.tenderRepo.findOne({
      where: { id },
      relations: ['building', 'unit', 'bids', 'bids.tenant', 'bids.tenant.user'],
    });
    if (!tender) throw new NotFoundException('Tender not found');
    return tender;
  }

  async submitBid(tenderId: string, tenantId: string, dto: any) {
    const tender = await this.getTender(tenderId);
    
    if (tender.status !== TenderStatus.OPEN) {
      throw new BadRequestException('Bidding is only allowed for OPEN tenders');
    }

    if (new Date() > tender.closing_date) {
      throw new BadRequestException('Tender has already closed');
    }

    if (Number(dto.proposed_rent) < Number(tender.minimum_acceptable_bid)) {
      throw new BadRequestException(`Proposed rent must be at least ${tender.minimum_acceptable_bid}`);
    }

    // Check if tenant already has an active bid
    const existing = await this.bidRepo.findOne({
      where: { tender_id: tenderId, tenant_id: tenantId },
    });
    if (existing) {
      throw new ConflictException('You have already submitted a bid for this tender.');
    }

    const bid = this.bidRepo.create({
      ...dto,
      tender_id: tenderId,
      tenant_id: tenantId,
      status: BidStatus.PENDING,
    });

    return this.bidRepo.save(bid);
  }

  async awardTender(tenderId: string, bidId: string) {
    const tender = await this.getTender(tenderId);
    if (tender.status === TenderStatus.AWARDED) {
      throw new BadRequestException('Tender is already awarded');
    }

    const bid = await this.bidRepo.findOne({
      where: { id: bidId },
      relations: ['tenant'],
    });
    if (!bid || bid.tender_id !== tenderId) {
      throw new NotFoundException('Bid not found for this tender');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Update Bid Status
      bid.status = BidStatus.ACCEPTED;
      await manager.save(bid);

      // 2. Reject other bids
      await manager.getRepository(TenderBid).update(
        { tender_id: tenderId, status: BidStatus.PENDING },
        { status: BidStatus.REJECTED }
      );

      // 3. Update Tender Status
      tender.status = TenderStatus.AWARDED;
      await manager.save(tender);

      // 4. Trigger Lease Creation (Draft)
      // Note: We'll need a simplified 'createDraftLease' logic or call leasesService
      const leaseData = {
        tenant_id: bid.tenant_id,
        unit_id: tender.unit_id,
        building_id: tender.building_id,
        start_date: bid.proposed_start_date,
        end_date: new Date(new Date(bid.proposed_start_date).setFullYear(new Date(bid.proposed_start_date).getFullYear() + 1)).toISOString().split('T')[0], // Default 1 year
        rent_amount: bid.proposed_rent,
        lease_number: `TNDR-${Date.now()}`,
        status: 'DRAFT',
      };

      // We use leasesService.create if possible, but it might require DTO validation
      // For now, let's assume we can call an internal creation method
      return this.leasesService.create(leaseData as any);
    });
  }

  async closeExpiredTenders() {
    const now = new Date();
    await this.tenderRepo.createQueryBuilder()
      .update(LeaseTender)
      .set({ status: TenderStatus.CLOSED })
      .where('status = :status AND closing_date < :now', { status: TenderStatus.OPEN, now })
      .execute();
  }
}
