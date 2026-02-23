import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class TerminateLeaseDto {
  @ApiProperty({ example: '2026-12-31', required: false })
  @IsOptional()
  @IsDateString()
  termination_date?: string;

  @ApiProperty({ example: 'Tenant vacated unit', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
