import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaseTender } from './entities/lease-tender.entity';
import { TenderBid } from './entities/tender-bid.entity';
import { TendersService } from './tenders.service';
import { TendersController } from './tenders.controller';
import { LeasesModule } from '../leases/leases.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaseTender, TenderBid]),
    LeasesModule,
  ],
  providers: [TendersService],
  controllers: [TendersController],
  exports: [TendersService],
})
export class TendersModule {}
