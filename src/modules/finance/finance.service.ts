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
    return this.bankAccountRepo.save(dto);
  }

  async getBankAccounts() {
    return this.bankAccountRepo.find();
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
          qb.andWhere('unit.building_id IN (:...bids)', { bids });
        } else {
          return [];
        }
      }
    }

    if (building_id) {
      qb.andWhere('unit.building_id = :building_id', { building_id });
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
    const vatRate = settings ? Number(settings.vat_rate) : 0.15;

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
      status: InvoiceStatus.PENDING,
      invoice_no: 'INV-' + Date.now(),
    });

    const savedInvoice = await this.invoiceRepo.save(invoice);

    // Save individual invoice items
    for (const item of dto.items) {
      await this.invoiceItemRepo.save(
        this.invoiceItemRepo.create({
          invoice: savedInvoice,
          type: item.type,
          amount: item.amount,
          description: item.description,
        }),
      );
    }

    return savedInvoice;
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
    return this.paymentRepo.save(payment);
  }

  async verifyPayment(
    id: string,
    dto: { verified_by: string; status: 'confirmed' | 'rejected' },
  ) {
    const payment = await this.paymentRepo.findOne({ // Changed this.paymentRepo to this.payRepo
      where: { id },
      relations: ['invoice', 'invoice.tenant'],
    });

    if (!payment) throw new NotFoundException('Payment record not found');

    payment.status = dto.status as PaymentStatus;
    // Update the payment record
    const updatedPayment = await this.paymentRepo.save(payment); // Changed this.paymentRepo to this.payRepo

    // If payment is confirmed, update the associated invoice amount_paid
    if (dto.status === 'confirmed' && payment.invoice) {
      const invoice = payment.invoice;
      const totalDue = Number(invoice.total_amount) + Number(invoice.late_fee_amount);
      
      invoice.amount_paid = Number(invoice.amount_paid) + Number(payment.amount);
      
      if (invoice.amount_paid >= totalDue) {
        invoice.status = InvoiceStatus.PAID;
      } else {
        invoice.status = InvoiceStatus.PARTIAL;
      }
      
      await this.invoiceRepo.save(invoice);
      // Notify tenant
      if (invoice.tenant) {
        await this.notificationsService.notify(
          invoice.tenant.id,
          'Payment Confirmed',
          `Your payment of ${payment.amount} for invoice #${invoice.invoice_no} has been verified.`,
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
      qb.andWhere('unit.site_id = :site_id', { site_id });
    }
    if (building_id) {
      qb.andWhere('unit.building_id = :building_id', { building_id });
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
    const vatRate = settings ? Number(settings.vat_rate) : 0.15;
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
          invoice_no: 'INV-' + lease.lease_number + '-' + Date.now(),
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

    const todayObj = referenceDate ? new Date(referenceDate) : new Date();
    const dueDateObj = new Date(invoice.due_date);
    const daysOverdue = Math.floor((todayObj.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysOverdue <= 0) return false;

    const balanceRemaining = Number(invoice.total_amount) - Number(invoice.amount_paid);
    if (balanceRemaining <= 0) return false;

    let dailyFee = 0;
    if (lateFeeType === 'PERCENTAGE') {
      dailyFee = balanceRemaining * (lateFeePct / 100);
    } else {
      dailyFee = lateFeeFlat; // Flat amount per day
    }
    
    const totalLateFee = dailyFee * daysOverdue;
    
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
      .leftJoin('p.invoice', 'inv')
      .select('inv.building_id', 'building_id')
      .addSelect('SUM(p.amount)', 'total_revenue')
      .where('p.status = :status', { status: 'confirmed' });

    if (params.building_id) qb.andWhere('inv.building_id = :bid', { bid: params.building_id });
    if (params.month) qb.andWhere('MONTH(p.created_at) = :m', { m: params.month });
    
    return qb.groupBy('inv.building_id').getRawMany();
  }

  // --- Expenses ---
  async createExpense(dto: CreateExpenseDto) { // Changed dto type to CreateExpenseDto
    const expense = this.expenseRepo.create(dto);
    return this.expenseRepo.save(expense);
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

  // --- Profit & Loss ---
  async getPandLReport(params: { building_id?: string; year?: number; month?: number }) {
    // 1. Revenue (Confirmed Payments)
    const revQb = this.paymentRepo.createQueryBuilder('p')
      .leftJoin('p.invoice', 'inv')
      .select('SUM(p.amount)', 'total')
      .where('p.status = :s', { s: 'confirmed' });
    
    if (params.building_id) revQb.andWhere('inv.building_id = :bid', { bid: params.building_id });
    if (params.year) revQb.andWhere('YEAR(p.created_at) = :y', { y: params.year });
    if (params.month) revQb.andWhere('MONTH(p.created_at) = :m', { m: params.month });

    const revRes = await revQb.getRawOne();
    const totalRevenue = Number(revRes?.total || 0);

    // 2. Expenses
    const expQb = this.expenseRepo.createQueryBuilder('e')
      .select('SUM(e.amount)', 'total');
    
    if (params.building_id) expQb.andWhere('e.building_id = :bid', { bid: params.building_id });
    if (params.year) expQb.andWhere('YEAR(e.date) = :y', { y: params.year });
    if (params.month) expQb.andWhere('MONTH(e.date) = :m', { m: params.month });

    const expRes = await expQb.getRawOne();
    const totalExpenses = Number(expRes?.total || 0);

    // 3. Category Breakdown
    const catQb = this.expenseRepo.createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('SUM(e.amount)', 'total');
    
    if (params.building_id) catQb.andWhere('e.building_id = :bid', { bid: params.building_id });
    if (params.year) catQb.andWhere('YEAR(e.date) = :y', { y: params.year });
    if (params.month) catQb.andWhere('MONTH(e.date) = :m', { m: params.month });

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
    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .select('SUM(invoice.tax_amount)', 'total_vat')
      .addSelect('SUM(invoice.total_amount * 0.02)', 'total_withholding')
      .where('invoice.status = :status', { status: InvoiceStatus.PAID });

    if (params.month) {
      qb.andWhere('EXTRACT(MONTH FROM invoice.due_date) = :month', { month: params.month });
    }

    return qb.getRawOne();
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

    const tenantName = `${payment.invoice.tenant.first_name} ${payment.invoice.tenant.last_name}`;

    return this.financePdfService.generateReceiptPdf({
      receipt_no: `RCP-${payment.id.substring(0, 8).toUpperCase()}`,
      amount: Number(payment.amount),
      payment_date: payment.created_at.toISOString().split('T')[0],
      tenant_name: tenantName,
      invoice_no: payment.invoice.invoice_no,
      reference_no: payment.reference_no,
    });
  }

  async getTenantLedgerPdf(tenantId: string): Promise<Buffer> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const ledger = await this.getTenantLedger(tenantId);
    const tenantName = `${tenant.first_name} ${tenant.last_name}`;

    return this.financePdfService.generateLedgerPdf(tenantName, ledger);
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
      totalBalanceDue,
      nextDueDate: soonestInvoice?.due_date || null,
      invoiceCount: invoices.length,
    };
  }
}
