import { Controller, Post, Body, UseGuards, Get, Query, Patch, Delete } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../common/guards/roles.guard'; // Commented out if not present
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateDepositAdviceDto } from './dto/create-deposit-advice.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PatchTaxRulesDto } from './dto/patch-tax-rules.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Finance')
@Controller('finance')
@UseGuards(JwtAuthGuard)
// @UseGuards(RolesGuard) // Uncomment if RolesGuard is available
export class FinanceController {
    @Get('invoices')
    @ApiOperation({ summary: 'Get invoices (scoped & filtered)' })
    @ApiResponse({ status: 200, description: 'Invoices list.' })
    async getInvoices(@Query('building_id') building_id?: string, @Query('status') status?: string) {
      return this.financeService.getInvoices(building_id, status);
    }

    @Patch('payments/:id/verify')
    @ApiOperation({ summary: 'Verify payment slip and update invoice status' })
    @ApiResponse({ status: 200, description: 'Payment verified.' })
    @ApiBody({ type: VerifyPaymentDto })
    async verifyPayment(@Body() dto: VerifyPaymentDto, @Query('id') id: string) {
      return this.financeService.verifyPayment(id, dto);
    }

    @Patch('tax-rules')
    @ApiOperation({ summary: 'Patch tax rules (VAT/Withholding)' })
    @ApiResponse({ status: 200, description: 'Tax rules patched.' })
    @ApiBody({ type: PatchTaxRulesDto })
    async patchTaxRules(@Body() dto: PatchTaxRulesDto) {
      // TODO: Patch VAT/Withholding settings
      return { status: 'patched', dto };
    }

    @Delete('invoices/:id')
    @ApiOperation({ summary: 'Void invoice (set status to CANCELLED)' })
    @ApiResponse({ status: 200, description: 'Invoice voided.' })
    async voidInvoice(@Query('id') id: string) {
      return this.financeService.voidInvoice(id);
    }
  constructor(private readonly financeService: FinanceService) {}

  @Post('bank-accounts')
  @ApiOperation({ summary: 'Create a bank account' })
  @ApiResponse({ status: 201, description: 'Bank account created.' })
  async createBankAccount(@Body() dto: CreateBankAccountDto) {
    return this.financeService.createBankAccount(dto);
  }

  @Post('invoices')
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
  async createDepositAdvice(@Body() dto: CreateDepositAdviceDto) {
    return this.financeService.createDepositAdvice(dto);
  }

  @Post('invoices/generate')
  @ApiOperation({ summary: 'Manually trigger BullMQ invoice generation' })
  @ApiResponse({ status: 200, description: 'Invoice generation triggered.' })
  async generateInvoices(@Body() data: { site_id?: string; building_id?: string }) {
    // TODO: Add BullMQ job trigger logic
    return { status: 'triggered', data };
  }

  @Post('tax-rules')
  @ApiOperation({ summary: 'Update tax rules (VAT/Withholding)' })
  @ApiResponse({ status: 200, description: 'Tax rules updated.' })
  async updateTaxRules(@Body() dto: any) {
    // TODO: Update VAT/Withholding settings
    return { status: 'updated', dto };
  }

  @Get('reports/revenue')
  @ApiOperation({ summary: 'Get revenue report' })
  @ApiResponse({ status: 200, description: 'Revenue report.' })
  async getRevenueReport(@Query('building_id') building_id?: string, @Query('month') month?: string) {
    return this.financeService.getRevenueReport(building_id, month);
  }

  @Get('reports/tax')
  @ApiOperation({ summary: 'Get tax compliance report' })
  @ApiResponse({ status: 200, description: 'Tax report.' })
  async getTaxReport(@Query('month') month?: string) {
    return this.financeService.getTaxReport(month);
  }
}
