import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { FinancePdfService } from './services/finance-pdf.service';
import { BankAccount } from './entities/bank-account.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import { Expense } from './entities/expense.entity';
import { DepositAdvice } from './entities/deposit-advice.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationSettings } from '../settings/entities/organization-settings.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Owner } from '../owners/entities/owner.entity';
import { forwardRef } from '@nestjs/common';
import { LeasesModule } from '../leases/leases.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankAccount,
      Invoice,
      InvoiceItem,
      Payment,
      Expense,
      DepositAdvice,
      OrganizationSettings,
      UserRole,
      Tenant,
      Owner,
    ]),
    NotificationsModule,
    forwardRef(() => LeasesModule),
    CommissionModule,
    BullModule.registerQueue({
      name: 'monthly-invoice',
    }),
    BullModule.registerQueue({
      name: 'overdue-penalty',
    }),
  ],
  providers: [FinanceService, FinancePdfService],
  controllers: [FinanceController],
  exports: [FinanceService],
})
export class FinanceModule {}
