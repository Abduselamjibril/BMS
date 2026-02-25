import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BankAccount } from './entities/bank-account.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem, InvoiceItemType } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import { DepositAdvice } from './entities/deposit-advice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateDepositAdviceDto } from './dto/create-deposit-advice.dto';
import { Lease } from '../leases/entities/lease.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Unit } from '../units/entities/unit.entity';

@Injectable()
export class FinanceService {
    async getInvoices(building_id?: string, status?: string) {
      // TODO: Implement scoped & filtered invoice retrieval
      return [];
    }

    async verifyPayment(id: string, dto: { verified_by: string; status: 'confirmed' | 'rejected' }) {
      // TODO: Implement payment verification and invoice status update
      return { status: 'verified', id, dto };
    }

    async voidInvoice(id: string) {
      // TODO: Implement void logic (set status to CANCELLED if not PAID)
      return { status: 'voided', id };
    }
  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(DepositAdvice)
    private readonly depositAdviceRepo: Repository<DepositAdvice>,
    private readonly dataSource: DataSource,
  ) {}

  async createBankAccount(dto: CreateBankAccountDto) {
    return this.bankAccountRepo.save(dto);
  }

  async createInvoice(dto: CreateInvoiceDto) {
    // Validation: Check Lease, Tenant, Unit existence and association
    const lease = await this.dataSource.getRepository(Lease).findOne({ where: { id: dto.lease_id }, relations: ['tenant', 'unit'] });
    if (!lease) throw new Error('Lease not found');
    if (!lease.tenant || lease.tenant.id !== dto.tenant_id) throw new Error('Tenant not associated with lease');
    if (!lease.unit || lease.unit.id !== dto.unit_id) throw new Error('Unit not associated with lease');

    // Calculate subtotal, tax, total
    const subtotal = dto.items.reduce((sum, item) => sum + item.amount, 0);
    const tax_amount = subtotal * 0.15;
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
    for (const item of dto.items) {
      await this.invoiceItemRepo.save({
        invoice: savedInvoice,
        type: item.type,
        amount: item.amount,
        description: item.description,
      } as any);
    }
    return savedInvoice;
  }

  async createPayment(dto: CreatePaymentDto) {
    // Validation: Check Invoice existence
    const invoice = await this.invoiceRepo.findOne({ where: { id: dto.invoice_id }, relations: ['tenant', 'unit'] });
    if (!invoice) throw new Error('Invoice not found');

    const payment = this.paymentRepo.create(dto);
    return this.paymentRepo.save(payment);
  }

  async createDepositAdvice(dto: CreateDepositAdviceDto) {
    return this.depositAdviceRepo.save(dto);
  }

  // BullMQ processor helpers
  async getActiveLeases(site_id?: string, building_id?: string) {
    // Query Lease repository for active leases filtered by site/building
    const qb = this.dataSource.getRepository(Lease).createQueryBuilder('lease')
      .where('lease.status = :status', { status: 'active' });
    if (site_id) {
      qb.andWhere('unit.site_id = :site_id', { site_id })
        .leftJoin('lease.unit', 'unit');
    }
    if (building_id) {
      qb.andWhere('unit.building_id = :building_id', { building_id })
        .leftJoin('lease.unit', 'unit');
    }
    return qb.getMany();
  }

  async getOverdueInvoices(date: string) {
    // Query Invoice repository for invoices due before date and not PAID
    return this.invoiceRepo.createQueryBuilder('invoice')
      .where('invoice.due_date < :date', { date })
      .andWhere('invoice.status != :status', { status: 'paid' })
      .getMany();
  }

  async applyPenalty(invoice: Invoice) {
    // Add penalty InvoiceItem and update status to OVERDUE
    const penaltyAmount = invoice.total_amount * 0.02; // 2% penalty
    const penaltyItem = this.invoiceItemRepo.create({
      invoice,
      type: InvoiceItemType.PENALTY,
      amount: penaltyAmount,
      description: 'Overdue penalty',
    } as any);
    await this.invoiceItemRepo.save(penaltyItem);
    invoice.status = InvoiceStatus.OVERDUE;
    return this.invoiceRepo.save(invoice);
  }

  async getRevenueReport(building_id?: string, month?: string) {
    // GROUP BY building_id and SUM confirmed payments
    const qb = this.paymentRepo.createQueryBuilder('payment')
      .select('unit.building_id', 'building_id')
      .addSelect('SUM(payment.amount)', 'total_revenue')
      .innerJoin('payment.invoice', 'invoice')
      .innerJoin('invoice.unit', 'unit')
      .where('payment.status = :status', { status: 'confirmed' });
    if (building_id) qb.andWhere('unit.building_id = :building_id', { building_id });
    if (month) qb.andWhere('EXTRACT(MONTH FROM payment.created_at) = :month', { month });
    qb.groupBy('unit.building_id');
    return qb.getRawMany();
  }

  async getTaxReport(month?: string) {
    // Aggregate VAT and Withholding for compliance reporting
    const qb = this.invoiceRepo.createQueryBuilder('invoice')
      .select('SUM(invoice.tax_amount)', 'total_vat')
      .addSelect('SUM(invoice.total_amount * 0.02)', 'total_withholding')
      .where('invoice.status = :status', { status: 'paid' });
    if (month) qb.andWhere('EXTRACT(MONTH FROM invoice.due_date) = :month', { month });
    return qb.getRawOne();
  }
}
