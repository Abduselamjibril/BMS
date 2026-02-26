import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BankAccount } from './entities/bank-account.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem, InvoiceItemType } from './entities/invoice-item.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { DepositAdvice } from './entities/deposit-advice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateDepositAdviceDto } from './dto/create-deposit-advice.dto';
import { Lease } from '../leases/entities/lease.entity';

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
    @InjectRepository(DepositAdvice)
    private readonly depositAdviceRepo: Repository<DepositAdvice>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * BANK ACCOUNTS
   */
  async createBankAccount(dto: CreateBankAccountDto) {
    return this.bankAccountRepo.save(dto);
  }

  /**
   * INVOICES
   */
  async getAllInvoices() {
    return this.invoiceRepo.find({
      relations: ['tenant', 'unit', 'lease'],
      order: { due_date: 'DESC' },
    });
  }

  async getInvoices(building_id?: string, status?: string) {
    const qb = this.invoiceRepo.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.unit', 'unit')
      .leftJoinAndSelect('invoice.lease', 'lease');

    if (building_id) {
      qb.andWhere('unit.buildingId = :building_id', { building_id });
    }

    if (status) {
      qb.andWhere('invoice.status = :status', { status });
    }

    const results = await qb.orderBy('invoice.due_date', 'DESC').getMany();
    if ((building_id || status) && results.length === 0) {
      throw new NotFoundException('No invoices found for the given filters');
    }
    return results;
  }

  async createInvoice(dto: CreateInvoiceDto) {
    // Validation: Check Lease, Tenant, Unit existence
    const lease = await this.dataSource.getRepository(Lease).findOne({ 
      where: { id: dto.lease_id }, 
      relations: ['tenant', 'unit'] 
    });

    if (!lease) throw new NotFoundException('Lease not found');
    if (!lease.tenant || lease.tenant.id !== dto.tenant_id) {
      throw new BadRequestException('Tenant not associated with lease');
    }
    if (!lease.unit || lease.unit.id !== dto.unit_id) {
      throw new BadRequestException('Unit not associated with lease');
    }

    // Calculate totals
    const subtotal = dto.items.reduce((sum, item) => sum + item.amount, 0);
    const tax_amount = subtotal * 0.15; // 15% VAT
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
      await this.invoiceItemRepo.save(this.invoiceItemRepo.create({
        invoice: savedInvoice,
        type: item.type,
        amount: item.amount,
        description: item.description,
      }));
    }

    return savedInvoice;
  }

  async voidInvoice(id: string) {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot void an invoice that is already paid');
    }

    invoice.status = InvoiceStatus.CANCELLED;
    return this.invoiceRepo.save(invoice);
  }

  /**
   * PAYMENTS
   */
  async createPayment(dto: CreatePaymentDto) {
    const invoice = await this.invoiceRepo.findOne({ 
      where: { id: dto.invoice_id } 
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const payment = this.paymentRepo.create({
      ...dto,
      invoice,
    });
    return this.paymentRepo.save(payment);
  }

  async verifyPayment(id: string, dto: { verified_by: string; status: 'confirmed' | 'rejected' }) {
    const payment = await this.paymentRepo.findOne({ 
      where: { id }, 
      relations: ['invoice'] 
    });
    
    if (!payment) throw new NotFoundException('Payment record not found');

    payment.status = dto.status as PaymentStatus;
    // Update the payment record
    const updatedPayment = await this.paymentRepo.save(payment);

    // If payment is confirmed, mark the associated invoice as PAID
    if (dto.status === 'confirmed' && payment.invoice) {
      const invoice = payment.invoice;
      invoice.status = InvoiceStatus.PAID;
      await this.invoiceRepo.save(invoice);
    }

    return updatedPayment;
  }

  /**
   * DEPOSIT ADVICE
   */
  async createDepositAdvice(dto: CreateDepositAdviceDto) {
    const bankAccount = await this.bankAccountRepo.findOne({ where: { id: dto.bank_account_id } });
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
    const qb = this.dataSource.getRepository(Lease).createQueryBuilder('lease')
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
    return this.invoiceRepo.createQueryBuilder('invoice')
      .where('invoice.due_date < :date', { date })
      .andWhere('invoice.status NOT IN (:...statuses)', { 
        statuses: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] 
      })
      .getMany();
  }

  async applyPenalty(invoice: Invoice) {
    const penaltyAmount = invoice.total_amount * 0.02; // 2% penalty
    
    const penaltyItem = this.invoiceItemRepo.create({
      invoice,
      type: InvoiceItemType.PENALTY,
      amount: penaltyAmount,
      description: 'Overdue penalty (2%)',
    });
    
    await this.invoiceItemRepo.save(penaltyItem);

    // Update invoice status and total
    invoice.total_amount = Number(invoice.total_amount) + penaltyAmount;
    invoice.status = InvoiceStatus.OVERDUE;
    
    return this.invoiceRepo.save(invoice);
  }

  /**
   * REPORTING
   */
  async getRevenueReport(building_id?: string, month?: string) {
    const qb = this.paymentRepo.createQueryBuilder('payment')
      .select('unit.buildingId', 'building_id')
      .addSelect('SUM(payment.amount)', 'total_revenue')
      .innerJoin('payment.invoice', 'invoice')
      .innerJoin('invoice.unit', 'unit')
      .where('payment.status = :status', { status: 'confirmed' });

    if (building_id) qb.andWhere('unit.buildingId = :building_id', { building_id });
    if (month) qb.andWhere('EXTRACT(MONTH FROM payment.created_at) = :month', { month });

    qb.groupBy('unit.buildingId');
    return qb.getRawMany();
  }

  async getTaxReport(month?: string) {
    const qb = this.invoiceRepo.createQueryBuilder('invoice')
      .select('SUM(invoice.tax_amount)', 'total_vat')
      .addSelect('SUM(invoice.total_amount * 0.02)', 'total_withholding') 
      .where('invoice.status = :status', { status: InvoiceStatus.PAID });

    if (month) {
        qb.andWhere('EXTRACT(MONTH FROM invoice.due_date) = :month', { month });
    }
    
    return qb.getRawOne();
  }
}