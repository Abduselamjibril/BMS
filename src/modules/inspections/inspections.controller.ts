import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { ItemCondition, InspectionType } from './entities/inspection.types';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';

@ApiTags('inspections')
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post('generate/:leaseId')
  @ApiOperation({ summary: 'Generate a new inspection (Admin)' })
  async generate(@Param('leaseId') leaseId: string, @Body('type') type: InspectionType) {
    return this.inspectionsService.createInspection(leaseId, type);
  }

  @Get('my-pending')
  @ApiOperation({ summary: 'Get current pending inspection for logged-in tenant' })
  async getMyPending(@Req() req: any) {
    return this.inspectionsService.getMyPendingInspection(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inspection details' })
  async getOne(@Param('id') id: string) {
    return this.inspectionsService.getInspection(id);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update inspection item condition/photos' })
  async updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: { condition?: any; comment?: string; photos?: string[] },
  ) {
    return this.inspectionsService.updateItem(itemId, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit inspection with signature (Tenant)' })
  async submit(
    @Param('id') id: string,
    @Body() dto: { signature_url?: string; notes?: string },
  ) {
    return this.inspectionsService.submitInspection(id, dto.signature_url, dto.notes);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify inspection (Admin)' })
  async verify(@Param('id') id: string, @Req() req: any) {
    return this.inspectionsService.verifyInspection(id, req.user);
  }
}
