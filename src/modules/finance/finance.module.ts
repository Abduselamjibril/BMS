import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { BankAccount } from './entities/bank-account.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import { DepositAdvice } from './entities/deposit-advice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankAccount,
      Invoice,
      InvoiceItem,
      Payment,
      DepositAdvice,
    ]),
    BullModule.registerQueue({
      name: 'monthly-invoice',
    }),
    BullModule.registerQueue({
      name: 'overdue-penalty',
    }),
  ],
  providers: [FinanceService],
  controllers: [FinanceController],
})
export class FinanceModule {}
