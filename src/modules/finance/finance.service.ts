import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { BankAccount } from './entities/bank-account.entity';
import { Expense } from './entities/expense.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem, InvoiceItemType } from './entities/invoice-item.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { DepositAdvice } from './entities/deposit-advice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateDepositAdviceDto } from './dto/create-deposit-advice.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Lease } from '../leases/entities/lease.entity';
import { OrganizationSettings } from '../settings/entities/organization-settings.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { UserBuilding } from '../users/entities/user-building.entity';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

import { FinancePdfService } from './services/finance-pdf.service';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(DepositAdvice)
    private readonly depositAdviceRepo: Repository<DepositAdvice>,
    @InjectRepository(OrganizationSettings)
    private readonly settingsRepo: Repository<OrganizationSettings>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectQueue('monthly-invoice')
    private readonly monthlyInvoiceQueue: Queue,
    @InjectQueue('overdue-penalty')
    private readonly overduePenaltyQueue: Queue,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly financePdfService: FinancePdfService,
  ) {}

  /**
   * BANK ACCOUNTS
   */
  async createBankAccount(dto: CreateBankAccountDto) {
    const account = this.bankAccountRepo.create({
      ...dto,
      current_balance: dto.opening_balance, // Initialize current balance with opening balance
    });
    return this.bankAccountRepo.save(account);
  }

  async getBankAccounts() {
    return this.bankAccountRepo.find();
  }

  async updateBankAccount(id: string, dto: Partial<CreateBankAccountDto>) {
    const account = await this.bankAccountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Bank account not found');
    Object.assign(account, dto);
    return this.bankAccountRepo.save(account);
  }

  async deleteBankAccount(id: string) {
    const account = await this.bankAccountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Bank account not found');
    await this.bankAccountRepo.remove(account);
    return { deleted: true };
  }

  /**
   * INVOICES
   */
  async getAllInvoices(authenticatedUser?: any) {
    return this.getInvoices(undefined, undefined, authenticatedUser);
  }

  async getInvoices(
    building_id?: string,
    status?: string,
    authenticatedUser?: any,
  ) {
    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.unit', 'unit')
      .leftJoinAndSelect('invoice.lease', 'lease')
      .leftJoinAndSelect('invoice.payments', 'payments')
      .leftJoinAndSelect('payments.bank_account', 'bank_account')
      .leftJoinAndSelect('invoice.items', 'items');

    if (authenticatedUser) {
      const currentUserId = authenticatedUser.id || authenticatedUser.sub;
      const userRoles = await this.userRoleRepo.find({
        where: { user: { id: currentUserId } },
        relations: ['role'],
      });
      const roleNames = userRoles.map((ur) => ur.role.name);

      if (roleNames.includes('tenant')) {
        const tenant = await this.tenantRepo.findOne({
          where: { user: { id: currentUserId } },
        });
        if (!tenant) return [];
        qb.andWhere('tenant.id = :tid', { tid: tenant.id });
      } else if (roleNames.includes('nominee_admin')) {
        const assignments = await this.dataSource
          .getRepository(UserBuilding)
          .find({
            where: { user: { id: currentUserId } },
            relations: ['building'],
          });
        const bids = assignments.map((a) => a.building.id);
        if (bids.length > 0) {
          qb.andWhere('unit.buildingId IN (:...bids)', { bids });
        } else {
          return [];
        }
      }
    }

    if (building_id) {
      qb.andWhere('unit.buildingId = :building_id', { building_id });
    }

    if (status) {
      qb.andWhere('invoice.status = :status', { status });
    }

    return qb.orderBy('invoice.due_date', 'DESC').getMany();
  }

  async createInvoice(dto: CreateInvoiceDto) {
    // Validation: Check Lease, Tenant, Unit existence
    const lease = await this.dataSource.getRepository(Lease).findOne({
      where: { id: dto.lease_id },
      relations: ['tenant', 'unit'],
    });

    if (!lease) throw new NotFoundException('Lease not found');
    if (!lease.tenant || lease.tenant.id !== dto.tenant_id) {
      throw new BadRequestException('Tenant not associated with lease');
    }
    if (!lease.unit || lease.unit.id !== dto.unit_id) {
      throw new BadRequestException('Unit not associated with lease');
    }

    // Fetch Tax Rules from settings
    const settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      throw new BadRequestException('Organization settings not found. Please configure tax rules first.');
    }
    const vatRate = Number(settings.vat_rate);

    // Calculate totals
    const subtotal = dto.items.reduce((sum, item) => sum + item.amount, 0);
    const tax_amount = subtotal * vatRate;
    const total_amount = subtotal + tax_amount;

    const invoice = this.invoiceRepo.create({
      lease,
      tenant: lease.tenant,
      unit: lease.unit,
      due_date: dto.due_date,
      subtotal,
      tax_amount,
      total_amount,
      status: (dto.status as InvoiceStatus) || InvoiceStatus.PENDING,
      invoice_no: await this.generateInvoiceNumber(),
    });

    const savedInvoice = await this.invoiceRepo.save(invoice);

    // If initial status is PENDING, notify immediately
    if (savedInvoice.status === InvoiceStatus.PENDING && savedInvoice.tenant) {
      await this.notificationsService.notify(
        savedInvoice.tenant.id,
        'New Invoice Issued',
        `Your invoice ${savedInvoice.invoice_no} has been issued. Amount: ${savedInvoice.total_amount} ETB`,
        NotificationType.FINANCE,
        { invoiceId: savedInvoice.id },
      );
    }
    let totalSettled = 0;
    let currentAdvance = Number(lease.advance_balance || 0);

    // Save individual invoice items AND handle Rent-Only Auto-Settlement
    for (const item of dto.items) {
      const savedItem = await this.invoiceItemRepo.save(
        this.invoiceItemRepo.create({
          invoice: savedInvoice,
          type: item.type,
          amount: item.amount,
          description: item.description,
        }),
      );

      // Auto-settlement logic specifically for RENT
      if (item.type === InvoiceItemType.RENT && currentAdvance > 0) {
        const itemGross = Number(item.amount) * (1 + vatRate);
        const canSettle = Math.min(currentAdvance, itemGross);
        
        if (canSettle > 0) {
          totalSettled += canSettle;
          currentAdvance -= canSettle;
          
          // Log the internal settlement payment
          await this.paymentRepo.save(
            this.paymentRepo.create({
              invoice: savedInvoice,
              amount: canSettle,
              reference_no: `AUTO-SETTLE-${savedInvoice.invoice_no}`,
              status: PaymentStatus.CONFIRMED,
              note: `Auto-settlement from Advance Balance for ${item.type}`,
            }),
          );
        }
      }
    }

    // Update Invoice and Lease with settlement results
    if (totalSettled > 0) {
      savedInvoice.amount_paid = Number(savedInvoice.amount_paid || 0) + totalSettled;
      if (savedInvoice.amount_paid >= Number(savedInvoice.total_amount)) {
        savedInvoice.status = InvoiceStatus.PAID;
      } else {
        savedInvoice.status = InvoiceStatus.PARTIAL;
      }
      await this.invoiceRepo.save(savedInvoice);

      const leaseRepo = this.dataSource.getRepository(Lease);
      await leaseRepo.update(lease.id, { advance_balance: currentAdvance });
    }

    return savedInvoice;
  }

  async updateDraftInvoice(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be edited');
    }

    const settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      throw new BadRequestException('Organization settings not found.');
    }
    const vatRate = Number(settings.vat_rate);

    // Remove old items
    await this.invoiceItemRepo.delete({ invoice: { id } });

    // Calculate new totals
    const subtotal = dto.items.reduce((sum, item) => sum + item.amount, 0);
    const tax_amount = subtotal * vatRate;
    const total_amount = subtotal + tax_amount;

    invoice.due_date = dto.due_date;
    invoice.subtotal = subtotal;
    invoice.tax_amount = tax_amount;
    invoice.total_amount = total_amount;

    const updatedInvoice = await this.invoiceRepo.save(invoice);

    // Save new items
    for (const item of dto.items) {
      await this.invoiceItemRepo.save(
        this.invoiceItemRepo.create({
          invoice: updatedInvoice,
          type: item.type,
          amount: item.amount,
          description: item.description,
        }),
      );
    }

    return this.invoiceRepo.findOne({ where: { id }, relations: ['items'] });
  }

  async confirmInvoice(id: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be approved');
    }

    invoice.status = InvoiceStatus.PENDING;
    const saved = await this.invoiceRepo.save(invoice);

    if (saved.tenant) {
      await this.notificationsService.notify(
        saved.tenant.id,
        'Invoice Approved',
        `Your invoice ${saved.invoice_no} has been approved and issued. Amount: ${saved.total_amount} ETB`,
        NotificationType.FINANCE,
        { invoiceId: saved.id },
      );
    }
    return saved;
  }

  async bulkConfirmInvoices(ids: string[]) {
    const results: any[] = [];
    for (const id of ids) {
      try {
        const res = await this.confirmInvoice(id);
        results.push(res);
      } catch (e) {
        console.error(`Bulk Confirm: Failed for ${id}`, e.message);
      }
    }
    return { approved: results.length, total: ids.length };
  }

  async voidInvoice(id: string) {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException(
        'Cannot void an invoice that is already paid',
      );
    }

    invoice.status = InvoiceStatus.CANCELLED;
    return this.invoiceRepo.save(invoice);
  }

  /**
   * PAYMENTS
   */
  async createPayment(dto: CreatePaymentDto) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: dto.invoice_id },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const payment = this.paymentRepo.create({
      ...dto,
      invoice,
    });
    const savedPayment = await this.paymentRepo.save(payment);

    // Update invoice status to PROCESSING
    invoice.status = InvoiceStatus.PROCESSING;
    await this.invoiceRepo.save(invoice);

    return savedPayment;
  }

  async verifyPayment(
    id: string,
    dto: { verified_by: string; status: 'confirmed' | 'rejected'; reason?: string },
  ) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['invoice', 'invoice.tenant', 'invoice.lease', 'bank_account'],
    });

    if (!payment) throw new NotFoundException('Payment record not found');

    payment.status = dto.status as PaymentStatus;
    if (dto.reason) {
      payment.note = payment.note ? `${payment.note} | Rejection: ${dto.reason}` : `Rejection: ${dto.reason}`;
    }
    
    // Update the payment record
    const updatedPayment = await this.paymentRepo.save(payment);

    // If payment is confirmed, update the associated invoice amount_paid and bank balance
    if (dto.status === 'confirmed' && payment.invoice) {
      const invoice = payment.invoice;
      const totalDue = Number(invoice.total_amount) + Number(invoice.late_fee_amount);
      const remainingBeforePayment = totalDue - Number(invoice.amount_paid);
      
      invoice.amount_paid = Number(invoice.amount_paid) + Number(payment.amount);
      
      // Calculate overpayment
      const overpayment = Math.max(0, Number(payment.amount) - remainingBeforePayment);
      
      if (invoice.amount_paid >= totalDue) {
        invoice.status = InvoiceStatus.PAID;
      } else {
        invoice.status = InvoiceStatus.PARTIAL;
      }
      
      await this.invoiceRepo.save(invoice);

      // Handle Overpayment -> Advance Balance
      if (overpayment > 0 && invoice.lease) {
        const leaseRepo = this.dataSource.getRepository(Lease);
        invoice.lease.advance_balance = Number(invoice.lease.advance_balance) + overpayment;
        await leaseRepo.save(invoice.lease);
      }

      // Update Selected or Default Bank Account Balance
      let bankToUpdate: BankAccount | null = payment.bank_account || null;
      if (!bankToUpdate) {
        const defaultBank = await this.bankAccountRepo.findOne({ where: { is_default: true } });
        bankToUpdate = defaultBank || (await this.bankAccountRepo.findOne({ where: {} }));
      }
      
      if (bankToUpdate) {
        bankToUpdate.current_balance = Number(bankToUpdate.current_balance) + Number(payment.amount);
        await this.bankAccountRepo.save(bankToUpdate);
      }
      
      // Notify tenant of confirmation
      if (invoice.tenant) {
        await this.notificationsService.notify(
          invoice.tenant.id,
          'Payment Confirmed',
          `Payment Confirmed`,
          NotificationType.FINANCE,
          { invoiceId: invoice.id, paymentId: payment.id },
        );
      }
    } else if (dto.status === 'rejected' && payment.invoice) {
      // Revert invoice status from PROCESSING to DRAFT (as requested)
      const invoice = payment.invoice;
      invoice.status = InvoiceStatus.DRAFT;
      await this.invoiceRepo.save(invoice);

      if (invoice.tenant) {
        // Notify tenant of rejection with the specific requested message
        await this.notificationsService.notify(
          invoice.tenant.id,
          'Payment Rejected',
          `Payment Rejected: please pay or send the right receipt and reference`,
          NotificationType.FINANCE,
          { invoiceId: invoice.id, paymentId: payment.id },
        );
      }
    }

    return updatedPayment;
  }

  /**
   * DEPOSIT ADVICE
   */
  async createDepositAdvice(dto: CreateDepositAdviceDto) {
    const bankAccount = await this.bankAccountRepo.findOne({
      where: { id: dto.bank_account_id },
    });
    if (!bankAccount) throw new NotFoundException('Bank account not found');

    const depositAdvice = this.depositAdviceRepo.create({
      ...dto,
      bank_account: bankAccount,
    });
    return this.depositAdviceRepo.save(depositAdvice);
  }

  /**
   * AUTOMATION / BULLMQ HELPERS
   */
  async getActiveLeases(site_id?: string, building_id?: string) {
    const qb = this.dataSource
      .getRepository(Lease)
      .createQueryBuilder('lease')
      .leftJoinAndSelect('lease.unit', 'unit')
      .where('lease.status = :status', { status: 'active' });

    if (site_id) {
      qb.leftJoin('unit.building', 'building');
      qb.andWhere('building.siteId = :site_id', { site_id });
    }
    if (building_id) {
      qb.andWhere('unit.buildingId = :building_id', { building_id });
    }
    return qb.getMany();
  }

  async getOverdueInvoices(date: string) {
    return this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.due_date < :date', { date })
      .andWhere('invoice.status NOT IN (:...statuses)', {
        statuses: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
      })
      .getMany();
  }

  async runDailyFinanceCron() {
    const todayObj = new Date();
    const today = todayObj.toISOString().split('T')[0];
    const leaseRepo = this.dataSource.getRepository(Lease);

    let invoicesGenerated = 0;
    
    // 1. Recurring Auto-Invoicing
    const leasesToBill = await leaseRepo
      .createQueryBuilder('lease')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .leftJoinAndSelect('lease.unit', 'unit')
      .where('lease.status = :status', { status: 'ACTIVE' })
      .andWhere('lease.next_billing_date <= :today', { today })
      .getMany();

    const settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      console.error('Finance Cron: Skipping run - Organization settings not found.');
      return { invoicesGenerated: 0, lateFeesApplied: 0 };
    }
    const vatRate = Number(settings.vat_rate);
    const lateFeeType = settings?.late_fee_type || 'PERCENTAGE';
    const lateFeePct = Number(settings?.late_fee_percentage || 2.0);
    const lateFeeFlat = Number(settings?.late_fee_flat_amount || 0.0);

    for (const lease of leasesToBill) {
      try {
        const subtotal = Number(lease.rent_amount) + Number(lease.service_charge);
        const tax_amount = subtotal * vatRate;

        const invoice = this.invoiceRepo.create({
          lease,
          tenant: lease.tenant,
          unit: lease.unit,
          due_date: new Date(todayObj.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal,
          tax_amount,
          total_amount: subtotal + tax_amount,
          amount_paid: 0,
          late_fee_amount: 0,
          status: InvoiceStatus.PENDING,
          invoice_no: await this.generateInvoiceNumber(),
        });
        const savedInvoice = await this.invoiceRepo.save(invoice);

        await this.invoiceItemRepo.save(
          this.invoiceItemRepo.create({
            invoice: savedInvoice,
            type: InvoiceItemType.RENT,
            amount: Number(lease.rent_amount),
            description: 'Recurring Rent',
          }),
        );

        if (Number(lease.service_charge) > 0) {
          await this.invoiceItemRepo.save(
            this.invoiceItemRepo.create({
              invoice: savedInvoice,
              type: InvoiceItemType.MAINTENANCE,
              amount: Number(lease.service_charge),
              description: 'Service Charge',
            }),
          );
        }

        // Advance next_billing_date
        const nextDate = new Date(lease.next_billing_date || today);
        if (lease.billing_cycle === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (lease.billing_cycle === 'QUARTERLY') nextDate.setMonth(nextDate.getMonth() + 3);
        else if (lease.billing_cycle === 'BIANNUALLY') nextDate.setMonth(nextDate.getMonth() + 6);
        else if (lease.billing_cycle === 'YEARLY') nextDate.setFullYear(nextDate.getFullYear() + 1);
        
        lease.next_billing_date = nextDate.toISOString().split('T')[0];
        await leaseRepo.save(lease);
        invoicesGenerated++;
      } catch (err) {
        console.error(`Failed recurring invoice for lease ${lease.id}`, err);
      }
    }

    // 2. Late Fee Engine
    const overdueInvoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.status IN (:...statuses)', { statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] })
      .andWhere('invoice.due_date < :today', { today })
      .getMany();

    let lateFeesApplied = 0;

    for (const inv of overdueInvoices) {
      try {
        const applied = await this.applyPenalty(inv, today);
        if (applied) lateFeesApplied++;
      } catch (err) {
        console.error(`Failed to apply penalty for invoice ${inv.id}`, err);
      }
    }

    return { invoicesGenerated, lateFeesApplied };
  }

  async applyPenalty(invoice: Invoice, referenceDate?: string): Promise<boolean> {
    const settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) return false;

    const lateFeeType = settings.late_fee_type || 'PERCENTAGE';
    const lateFeePct = Number(settings.late_fee_percentage || 2.0);
    const lateFeeFlat = Number(settings.late_fee_flat_amount || 0.0);
    const lateFeeGraceDays = Number(settings.late_fee_grace_period_days || 0);

    const todayObj = referenceDate ? new Date(referenceDate) : new Date();
    const dueDateObj = new Date(invoice.due_date);
    const daysOverdue = Math.floor((todayObj.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysOverdue <= lateFeeGraceDays) return false;

    const balanceRemaining = Number(invoice.total_amount) - Number(invoice.amount_paid);
    if (balanceRemaining <= 0) return false;

    let dailyFee = 0;
    if (lateFeeType === 'PERCENTAGE') {
      dailyFee = balanceRemaining * (lateFeePct / 100);
    } else {
      dailyFee = lateFeeFlat; // Flat amount per day
    }
    
    const totalLateFee = dailyFee * (daysOverdue - lateFeeGraceDays);
    
    if (totalLateFee > Number(invoice.late_fee_amount)) {
      invoice.late_fee_amount = totalLateFee;
      if (invoice.status === InvoiceStatus.PENDING) {
        invoice.status = InvoiceStatus.OVERDUE;
      }
      await this.invoiceRepo.save(invoice);
      return true;
    }

    return false;
  }

  /**
   * REPORTING
   */
  async getRevenueReport(params: { building_id?: string; month?: string }) {
    const qb = this.paymentRepo.createQueryBuilder('p')
      .innerJoin('p.invoice', 'inv')
      .innerJoin('inv.unit', 'u')
      .select('u.buildingId', 'building_id')
      .addSelect('SUM(p.amount)', 'total_revenue')
      .where('p.status = :status', { status: 'confirmed' });

    if (params.building_id) qb.andWhere('u.buildingId = :bid', { bid: params.building_id });
    if (params.month) qb.andWhere('EXTRACT(MONTH FROM "p"."created_at") = :m', { m: params.month });
    
    return qb.groupBy('u.buildingId').getRawMany();
  }

  // --- Expenses ---
  async createExpense(dto: CreateExpenseDto) {
    const expense = this.expenseRepo.create(dto);
    const savedExpense = await this.expenseRepo.save(expense);

    // If a bank account is linked, decrement its balance
    if (dto.bank_account_id) {
      const bank = await this.bankAccountRepo.findOne({ where: { id: dto.bank_account_id } });
      if (bank) {
        bank.current_balance = Number(bank.current_balance) - Number(dto.amount);
        await this.bankAccountRepo.save(bank);
      }
    }

    return savedExpense;
  }

  async verifyDepositAdvice(id: string, status: 'confirmed' | 'rejected', processedBy: string) {
    const advice = await this.depositAdviceRepo.findOne({ 
      where: { id },
      relations: ['bank_account']
    });
    if (!advice) throw new NotFoundException('Deposit advice not found');

    const oldStatus = advice.status;
    advice.status = status;
    advice.processed_by = processedBy;
    const updated = await this.depositAdviceRepo.save(advice);

    // If confirmed and was pending, increment the bank balance
    if (status === 'confirmed' && oldStatus !== 'confirmed' && advice.bank_account) {
      const bank = advice.bank_account;
      bank.current_balance = Number(bank.current_balance) + Number(advice.amount);
      await this.bankAccountRepo.save(bank);
    }

    return updated;
  }

  async getExpenses(params: { building_id?: string; category?: string; start_date?: string; end_date?: string }) {
    const qb = this.expenseRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.building', 'b');
    
    if (params.building_id) qb.andWhere('e.building_id = :bid', { bid: params.building_id });
    if (params.category) qb.andWhere('e.category = :c', { c: params.category });
    if (params.start_date) qb.andWhere('e.date >= :s', { s: params.start_date });
    if (params.end_date) qb.andWhere('e.date <= :e', { e: params.end_date });

    return qb.orderBy('e.date', 'DESC').getMany();
  }

  async getDepositAdvices() {
    return this.depositAdviceRepo.find({
      relations: ['bank_account'],
      order: { created_at: 'DESC' }
    });
  }

  // --- Profit & Loss ---
  async getPandLReport(params: { building_id?: string; year?: number; month?: number }) {
    // 1. Revenue (Confirmed Payments)
    const revQb = this.paymentRepo.createQueryBuilder('p')
      .innerJoin('p.invoice', 'inv')
      .innerJoin('inv.unit', 'u')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :s', { s: 'confirmed' });
    
    if (params.building_id) revQb.andWhere('u.buildingId = :bid', { bid: params.building_id });
    if (params.year) revQb.andWhere('EXTRACT(YEAR FROM "p"."created_at") = :y', { y: params.year });
    if (params.month) revQb.andWhere('EXTRACT(MONTH FROM "p"."created_at") = :m', { m: params.month });

    const revRes = await revQb.getRawOne();
    const totalRevenue = Number(revRes?.total || 0);

    // 2. Expenses
    const expQb = this.expenseRepo.createQueryBuilder('e')
      .select('SUM(e.amount)', 'total');
    
    if (params.building_id) expQb.andWhere('e.building_id = :bid', { bid: params.building_id });
    if (params.year) expQb.andWhere('EXTRACT(YEAR FROM e.date) = :y', { y: params.year });
    if (params.month) expQb.andWhere('EXTRACT(MONTH FROM e.date) = :m', { m: params.month });

    const expRes = await expQb.getRawOne();
    const totalExpenses = Number(expRes?.total || 0);

    // 3. Category Breakdown
    const catQb = this.expenseRepo.createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('SUM(e.amount)', 'total');
    
    if (params.building_id) catQb.andWhere('e.building_id = :bid', { bid: params.building_id });
    if (params.year) catQb.andWhere('EXTRACT(YEAR FROM e.date) = :y', { y: params.year });
    if (params.month) catQb.andWhere('EXTRACT(MONTH FROM e.date) = :m', { m: params.month });

    const categories = await catQb.groupBy('e.category').getRawMany();

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      net_profit: totalRevenue - totalExpenses,
      categories: categories.map(c => ({ name: c.category, amount: Number(c.total) }))
    };
  }

  async updateTaxRules(dto: { vat_rate: number; withholding_rate: number }) {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepo.create({
        ...dto,
        company_name: 'Default Company',
        tin_number: '0000000000',
        vat_number: '0000000000',
      });
    } else {
      settings.vat_rate = dto.vat_rate;
      settings.withholding_rate = dto.withholding_rate;
    }
    return this.settingsRepo.save(settings);
  }

  async generateInvoicesTrigger(data: {
    site_id?: string;
    building_id?: string;
  }) {
    await this.monthlyInvoiceQueue.add('generate-invoices', data);
    return { status: 'queued', job: 'monthly-invoice' };
  }

  async getTaxReport(params: { month?: string }) {
    const settings = await this.settingsRepo.findOne({ where: {} });
    const withholdingRate = settings ? Number(settings.withholding_rate) : 0.02;

    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .select('SUM(invoice.tax_amount)', 'total_vat')
      .addSelect(`SUM(invoice.total_amount * ${withholdingRate})`, 'total_withholding')
      .where('invoice.status = :status', { status: InvoiceStatus.PAID });

    if (params.month) {
      qb.andWhere('EXTRACT(MONTH FROM invoice.due_date) = :month', { month: params.month });
    }

    return qb.getRawOne();
  }

  private async generateInvoiceNumber(): Promise<string> {
    const result = await this.invoiceRepo
      .createQueryBuilder('invoice')
      // Only pick invoices that follow the 'INV-digits' strictly (e.g. INV-001)
      // This ignores old alphanumeric or date-based numbers (e.g. INV-20260407-ABCD)
      .select('MAX(CAST(SUBSTRING(invoice.invoice_no, 5) AS BIGINT))', 'max')
      .where("invoice.invoice_no ~ '^INV-[0-9]+$'")
      .getRawOne();

    const nextNumber = (parseInt(result?.max, 10) || 0) + 1;
    return `INV-${nextNumber.toString().padStart(3, '0')}`;
  }

  async getTenantLedger(tenantId: string) {
    const invoices = await this.invoiceRepo.find({
      where: { tenant: { id: tenantId } },
      order: { due_date: 'ASC' }
    });
    
    // We'll use string 'confirmed' since enum could vary
    const payments = await this.paymentRepo.find({
      where: { invoice: { tenant: { id: tenantId } }, status: 'confirmed' as any },
      relations: ['invoice'],
      order: { created_at: 'ASC' }
    });

    const ledger: any[] = [];
    
    for (const inv of invoices) {
      ledger.push({
        id: inv.id,
        date: inv.due_date,
        type: 'INVOICE',
        reference: inv.invoice_no,
        description: `Invoice ${inv.invoice_no}`,
        debit: Number(inv.total_amount) + Number(inv.late_fee_amount),
        credit: 0,
        timestamp: new Date(inv.due_date).getTime()
      });
    }

    for (const pay of payments) {
      ledger.push({
        id: pay.id,
        date: pay.created_at.toISOString().split('T')[0],
        type: 'PAYMENT',
        reference: pay.reference_no,
        description: `Payment for ${pay.invoice?.invoice_no || ''}`,
        debit: 0,
        credit: Number(pay.amount),
        timestamp: new Date(pay.created_at).getTime()
      });
    }

    ledger.sort((a, b) => a.timestamp - b.timestamp);
    
    let balance = 0;
    for (const entry of ledger) {
      balance += entry.debit - entry.credit;
      entry.balance = balance;
    }

    return ledger;
  }

  async getPaymentReceiptPdf(paymentId: string): Promise<Buffer> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['invoice', 'invoice.tenant'],
    });

    if (!payment) throw new NotFoundException('Payment not found');

    const settings = await this.settingsRepo.findOne({ where: {} });
    const tenantName = `${payment.invoice.tenant.first_name} ${payment.invoice.tenant.last_name}`;

    return this.financePdfService.generateReceiptPdf({
      receipt_no: `RCP-${payment.id.substring(0, 8).toUpperCase()}`,
      amount: Number(payment.amount),
      payment_date: payment.created_at.toISOString().split('T')[0],
      tenant_name: tenantName,
      invoice_no: payment.invoice.invoice_no,
      reference_no: payment.reference_no,
      company_name: settings?.company_name,
      logo_path: settings?.logo_path,
    });
  }

  async getTenantLedgerPdf(tenantId: string): Promise<Buffer> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const ledger = await this.getTenantLedger(tenantId);
    const settings = await this.settingsRepo.findOne({ where: {} });
    const tenantName = `${tenant.first_name} ${tenant.last_name}`;

    return this.financePdfService.generateLedgerPdf(tenantName, ledger, {
      company_name: settings?.company_name,
      logo_path: settings?.logo_path,
    });
  }

  async getTenantSummary(userId: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!tenant) throw new NotFoundException('Tenant profile not found');

    const invoices = await this.invoiceRepo.find({
      where: {
        tenant: { id: tenant.id },
        status: In([InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE]),
      },
    });

    const totalBalanceDue = invoices.reduce((sum, inv) => {
      const due = Number(inv.total_amount) + Number(inv.late_fee_amount) - Number(inv.amount_paid);
      return sum + Math.max(0, due);
    }, 0);

    // Find soonest due date
    const soonestInvoice = invoices.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

    return {
      id: tenant.id,
      totalBalanceDue,
      nextDueDate: soonestInvoice?.due_date || null,
      invoiceCount: invoices.length,
    };
  }

  /**
   * ADVANCED ANALYTICS
   */
  async getFinanceAnalytics() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const lastMonthDate = new Date();
    lastMonthDate.setMonth(now.getMonth() - 1);
    const lastMonth = lastMonthDate.getMonth() + 1;
    const lastYear = lastMonthDate.getFullYear();

    // 1. Revenue Trends (Actual Received)
    const currentRevenue = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: 'confirmed' })
      .andWhere('EXTRACT(MONTH FROM p.created_at) = :month', { month: currentMonth })
      .andWhere('EXTRACT(YEAR FROM p.created_at) = :year', { year: currentYear })
      .getRawOne();

    const previousRevenue = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :status', { status: 'confirmed' })
      .andWhere('EXTRACT(MONTH FROM p.created_at) = :month', { month: lastMonth })
      .andWhere('EXTRACT(YEAR FROM p.created_at) = :year', { year: lastYear })
      .getRawOne();

    const cur = Number(currentRevenue?.total || 0);
    const prev = Number(previousRevenue?.total || 0);
    const trend = prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    // 2. 6-Month Chart Data
    const chartData: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const mName = d.toLocaleString('default', { month: 'short' });

      const res = await this.paymentRepo
        .createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.status = :status', { status: 'confirmed' })
        .andWhere('EXTRACT(MONTH FROM p.created_at) = :month', { month: m })
        .andWhere('EXTRACT(YEAR FROM p.created_at) = :year', { year: y })
        .getRawOne();
      
      chartData.push({ month: mName, year: y, total: Number(res?.total || 0) });
    }

    // 3. Outstanding Balance per Building
    const buildingArrears = await this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoin('inv.unit', 'u')
      .select('u."buildingId"', 'building_id')
      .addSelect('SUM(inv.total_amount - inv.amount_paid)', 'outstanding')
      .where('inv.status IN (:...statuses)', { statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] })
      .groupBy('u."buildingId"')
      .getRawMany();

    return {
      revenueTrend: {
        current: cur,
        previous: prev,
        percentage: trend,
        direction: trend >= 0 ? 'up' : 'down',
      },
      chartData,
      buildingStats: buildingArrears.map(b => ({
        buildingId: b.building_id,
        outstanding: Number(b.outstanding || 0)
      }))
    };
  }

  async resendInvoiceNotification(id: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['tenant'],
    });

    if (!invoice || !invoice.tenant) throw new NotFoundException('Invoice or tenant not found');

    await this.notificationsService.notify(
      invoice.tenant.id,
      'Invoice Reminder',
      `This is a reminder for invoice #${invoice.invoice_no} due on ${invoice.due_date}. Total: ${invoice.total_amount}`,
      NotificationType.FINANCE,
      { invoiceId: invoice.id },
    );

    return { success: true };
  }
}
