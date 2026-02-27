import { Controller, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AutomationCronService } from './automation-cron.service';

@ApiTags('automations')
@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationCronService: AutomationCronService) {}

  @Post('run/:jobName')
  @ApiOperation({ summary: 'Manually trigger an automation cron job by name (admin override)' })
  async runJob(@Param('jobName') jobName: string) {
    return this.automationCronService.runJobByName(jobName);
  }
}
