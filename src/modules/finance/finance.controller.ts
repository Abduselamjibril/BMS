import { Auth } from '../../common/decorators/auth.decorator';
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Patch,
  Delete,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../common/guards/roles.guard'; // Commented out if not present
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateDepositAdviceDto } from './dto/create-deposit-advice.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PatchTaxRulesDto } from './dto/patch-tax-rules.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiQuery,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Finance')
@Controller('finance')
@Auth()
// @UseGuards(RolesGuard) // Uncomment if RolesGuard is available
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('invoices/all')
  @Permissions('finance:invoices:all')
  @ApiOperation({ summary: 'List all invoices (no filters)' })
  @ApiResponse({ status: 200, description: 'All invoices.' })
  async getAllInvoices(@Req() req: any) {
    return this.financeService.getAllInvoices(req.user);
  }
  @Get('invoices')
  @ApiOperation({ summary: 'Get invoices (scoped & filtered)' })
  @ApiResponse({ status: 200, description: 'Invoices list.' })
  async getInvoices(
    @Req() req: any,
    @Query('building_id') building_id?: string,
    @Query('status') status?: string,
  ) {
    return this.financeService.getInvoices(building_id, status, req.user);
  }

  @Get('ledger/tenant/:tenantId')
  @Permissions('finance:ledger:read')
  @ApiOperation({ summary: 'Get financial ledger for a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant ledger array.' })
  async getTenantLedger(@Param('tenantId') tenantId: string) {
    return this.financeService.getTenantLedger(tenantId);
  }

  @Get('my-summary')
  @ApiOperation({ summary: 'Get summary for the authenticated tenant' })
  async getMySummary(@Req() req: any) {
    return this.financeService.getTenantSummary(req.user.id);
  }

  @Get('ledger/tenant/:tenantId/pdf')
  @Permissions('finance:ledger:read')
  @ApiOperation({ summary: 'Download financial ledger (PDF)' })
  async getTenantLedgerPdf(
    @Param('tenantId') tenantId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.financeService.getTenantLedgerPdf(tenantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=ledger-${tenantId}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('payments/:id/receipt')
  @ApiOperation({ summary: 'Download payment receipt (PDF)' })
  async getPaymentReceiptPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.financeService.getPaymentReceiptPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=receipt-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Patch('payments/:id/verify')
  @Permissions('finance:payments:verify')
  @ApiOperation({ summary: 'Verify payment slip and update invoice status' })
  @ApiResponse({ status: 200, description: 'Payment verified.' })
  @ApiParam({
    name: 'id',
    description: 'Payment ID (UUID) to verify',
    required: true,
    example: 'a7d4c5e4-1a1a-413a-aa3d-4c362020d3e8',
  })
  async verifyPayment(
    @Body() dto: VerifyPaymentDto,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const verified_by = req.user.id;
    return this.financeService.verifyPayment(id, {
      verified_by,
      status: dto.status,
    });
  }

  @Patch('tax-rules')
  @Permissions('finance:tax_rules:update')
  @ApiOperation({ summary: 'Patch tax rules (VAT/Withholding)' })
  @ApiResponse({ status: 200, description: 'Tax rules patched.' })
  @ApiBody({ type: PatchTaxRulesDto })
  @ApiBody({ type: PatchTaxRulesDto })
  async patchTaxRules(@Body() dto: PatchTaxRulesDto) {
    return this.financeService.updateTaxRules(dto);
  }

  @Delete('invoices/:id')
  @Permissions('finance:invoices:void')
  @ApiOperation({ summary: 'Void invoice (set status to CANCELLED)' })
  @ApiResponse({ status: 200, description: 'Invoice voided.' })
  @ApiParam({
    name: 'id',
    description: 'Invoice ID (UUID) to void',
    required: true,
    example: '020cab99-902d-4bc8-b1cb-44f445b4a7f6',
  })
  async voidInvoice(@Param('id') id: string) {
    return this.financeService.voidInvoice(id);
  }

  @Post('bank-accounts')
  @Permissions('finance:bank_accounts:create')
  @ApiOperation({ summary: 'Create a bank account' })
  @ApiResponse({ status: 201, description: 'Bank account created.' })
  async createBankAccount(@Body() dto: CreateBankAccountDto) {
    return this.financeService.createBankAccount(dto);
  }

  @Get('bank-accounts')
  @Permissions('finance:bank_accounts:read')
  @ApiOperation({ summary: 'List all bank accounts' })
  @ApiResponse({ status: 200, description: 'Bank accounts list.' })
  async getBankAccounts() {
    return this.financeService.getBankAccounts();
  }

  @Post('invoices')
  @Permissions('finance:invoices:create')
  @ApiOperation({ summary: 'Create an invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created.' })
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.financeService.createInvoice(dto);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record a payment' })
  @ApiResponse({ status: 201, description: 'Payment recorded.' })
  async createPayment(@Body() dto: CreatePaymentDto) {
    return this.financeService.createPayment(dto);
  }

  @Post('deposit-advice')
  @ApiOperation({ summary: 'Create deposit advice' })
  @ApiResponse({ status: 201, description: 'Deposit advice created.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bank_account_id: {
          type: 'string',
          format: 'uuid',
          example: '4cbce5e8-92e4-4c03-b0c6-6a7b7bab64aa',
          description: 'Bank account ID',
        },
        amount: {
          type: 'number',
          example: 63250,
          description: 'Deposit amount',
        },
        reference_no: {
          type: 'string',
          example: 'DEP-20260225-001',
          description: 'Deposit reference number',
        },
        deposit_date: {
          type: 'string',
          format: 'date',
          example: '2026-02-25',
          description: 'Deposit date',
        },
      },
      required: ['bank_account_id', 'amount', 'reference_no', 'deposit_date'],
      example: {
        bank_account_id: '4cbce5e8-92e4-4c03-b0c6-6a7b7bab64aa',
        amount: 63250,
        reference_no: 'DEP-20260225-001',
        deposit_date: '2026-02-25',
      },
    },
  })
  async createDepositAdvice(@Body() dto: CreateDepositAdviceDto) {
    return this.financeService.createDepositAdvice(dto);
  }

  @Post('invoices/generate')
  @Permissions('finance:invoices:generate')
  @ApiOperation({ summary: 'Manually trigger BullMQ invoice generation' })
  @ApiResponse({ status: 200, description: 'Invoice generation triggered.' })
  async generateInvoices(@Body() data: GenerateInvoicesDto) {
    return this.financeService.generateInvoicesTrigger(data);
  }

  @Post('tax-rules')
  @Permissions('finance:tax_rules:update')
  @ApiOperation({ summary: 'Update tax rules (VAT/Withholding)' })
  @ApiResponse({ status: 200, description: 'Tax rules updated.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        vat_rate: {
          type: 'number',
          example: 0.15,
          description: 'VAT rate (e.g., 0.15 for 15%)',
        },
        withholding_rate: {
          type: 'number',
          example: 0.02,
          description: 'Withholding rate (e.g., 0.02 for 2%)',
        },
      },
      required: ['vat_rate', 'withholding_rate'],
      example: {
        vat_rate: 0.15,
        withholding_rate: 0.02,
      },
    },
  })
  async updateTaxRules(@Body() dto: PatchTaxRulesDto) {
    return this.financeService.updateTaxRules(dto);
  }

  @Get('reports/revenue')
  @Permissions('finance:reports:revenue')
  @ApiOperation({ summary: 'Get revenue report' })
  @ApiResponse({ status: 200, description: 'Revenue report.' })
  async getRevenueReport(
    @Query('building_id') building_id?: string,
    @Query('month') month?: string,
  ) {
    return this.financeService.getRevenueReport({ building_id, month });
  }

  @Get('reports/tax')
  @Permissions('finance:reports:tax')
  @ApiOperation({ summary: 'Get tax compliance report' })
  @ApiResponse({ status: 200, description: 'Tax report.' })
  async getTaxReport(@Query('month') month?: string) {
    return this.financeService.getTaxReport({ month });
  }

  @Post('expenses')
  @Permissions('finance:expenses:create')
  @ApiOperation({ summary: 'Record an expense' })
  @ApiResponse({ status: 201, description: 'Expense recorded.' })
  async createExpense(@Body() dto: CreateExpenseDto) {
    return this.financeService.createExpense(dto);
  }

  @Get('expenses')
  @Permissions('finance:expenses:read')
  @ApiOperation({ summary: 'List all expenses' })
  @ApiResponse({ status: 200, description: 'Expenses list.' })
  async getExpenses(
    @Query('building_id') building_id?: string,
    @Query('category') category?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.financeService.getExpenses({ building_id, category, start_date, end_date });
  }

  @Get('reports/p-and-l')
  @Permissions('finance:reports:p-and-l')
  @ApiOperation({ summary: 'Get Profit & Loss report' })
  @ApiResponse({ status: 200, description: 'P&L report data.' })
  async getPandLReport(
    @Query('building_id') building_id?: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.financeService.getPandLReport({ building_id, year, month });
  }
}
