import { Controller, Get, Post, Put, Body, Query, Param, UseGuards } from '@nestjs/common';
import { CommissionService } from './services/commission.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('commissions')
@UseGuards(JwtAuthGuard)
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  @Get()
  getCommissions(@Query() filters: any) {
    return this.commissionService.getCommissions(filters);
  }

  @Get('rules')
  getRules() {
    return this.commissionService.getRules();
  }

  @Post('rules')
  createRule(@Body() dto: any) {
    return this.commissionService.createRule(dto);
  }

  @Get('payments')
  getPayments() {
    return this.commissionService.getPayments();
  }

  @Post('payments')
  createPayment(@Body() dto: { commission_ids: string[]; reference_no: string; payment_date: string }) {
    return this.commissionService.createPayment(dto);
  }

  @Put(':id/approve')
  approveCommission(@Param('id') id: string) {
    return this.commissionService.approveCommission(id);
  }
}
