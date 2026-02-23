import { Controller, Get } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminActivityLog } from './entities/admin-activity-log.entity';

@ApiTags('audit')
@Controller('audit')
@Auth()
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
