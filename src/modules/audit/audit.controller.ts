import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminActivityLog } from './entities/admin-activity-log.entity';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(
    @InjectRepository(AdminActivityLog)
    private readonly auditRepo: Repository<AdminActivityLog>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all admin activity logs' })
  async findAll() {
    return this.auditRepo.find({ order: { timestamp: 'DESC' } });
  }
}
