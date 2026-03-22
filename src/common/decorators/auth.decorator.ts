import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/common/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

export function Auth() {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), ApiBearerAuth());
}
