import { Controller, Post, Patch, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AutomationCronService } from './automation-cron.service';

@ApiTags('automations')
@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationCronService: AutomationCronService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get enabled/disabled status of all automation jobs' })
  getStatuses() {
    return this.automationCronService.getJobStatuses();
  }

  @Post('run/:jobName')
  @ApiOperation({
    summary: 'Manually trigger an automation cron job by name (admin override)',
  })
  async runJob(@Param('jobName') jobName: string) {
    return this.automationCronService.runJobByName(jobName);
  }

  @Patch(':jobName/enable')
  @ApiOperation({ summary: 'Enable an automation job' })
  enableJob(@Param('jobName') jobName: string) {
    this.automationCronService.enableJob(jobName);
    return { status: 'enabled', job: jobName };
  }

  @Patch(':jobName/disable')
  @ApiOperation({ summary: 'Disable an automation job' })
  disableJob(@Param('jobName') jobName: string) {
    this.automationCronService.disableJob(jobName);
    return { status: 'disabled', job: jobName };
  }
}
