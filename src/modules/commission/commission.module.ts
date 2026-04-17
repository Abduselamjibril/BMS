import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionRule } from './entities/commission-rule.entity';
import { Commission } from './entities/commission.entity';
import { CommissionPayment } from './entities/commission-payment.entity';
import { CommissionPaymentItem } from './entities/commission-payment-item.entity';
import { CommissionService } from './services/commission.service';
import { CommissionCalculationService } from './services/commission-calculation.service';
import { CommissionController } from './commission.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommissionRule,
      Commission,
      CommissionPayment,
      CommissionPaymentItem,
    ]),
  ],
  providers: [CommissionService, CommissionCalculationService],
  controllers: [CommissionController],
  exports: [CommissionService, CommissionCalculationService],
})
export class CommissionModule { }
