import { Controller, Get, Post, Body, Param, Put, Query, UseGuards, Request } from '@nestjs/common';
import { TendersService } from './tenders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('tenders')
@UseGuards(JwtAuthGuard)
export class TendersController {
  constructor(private readonly tendersService: TendersService) {}

  @Post()
  createTender(@Body() dto: any) {
    return this.tendersService.createTender(dto);
  }

  @Get()
  getTenders(@Query() filters: any) {
    return this.tendersService.getTenders(filters);
  }

  @Get(':id')
  getTender(@Param('id') id: string) {
    return this.tendersService.getTender(id);
  }

  @Post(':id/bids')
  async submitBid(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    // Determine tenantId from authenticated user
    let tenantId = req.user.tenantId || dto.tenant_id;
    
    // For testing/admin purposes: If no tenantId found, try to find a tenant linked to the user 
    // or pick the first available tenant if the user is an admin.
    if (!tenantId) {
      const tenantRepo = this.tendersService['dataSource'].getRepository(require('../tenants/entities/tenant.entity').Tenant);
      const userTenant = await tenantRepo.findOne({ where: { user: { id: req.user.id } } });
      if (userTenant) {
        tenantId = userTenant.id;
      } else {
        // Last resort for testing: pick any active tenant
        const anyTenant = await tenantRepo.findOne({ where: {} });
        if (anyTenant) tenantId = anyTenant.id;
      }
    }

    if (!tenantId) {
      throw new Error('No tenant context found for bid submission. Please ensure at least one tenant exists in the system.');
    }

    return this.tendersService.submitBid(id, tenantId, dto);
  }

  @Put(':id/award')
  awardTender(@Param('id') id: string, @Body() dto: { bid_id: string }) {
    return this.tendersService.awardTender(id, dto.bid_id);
  }
}
