import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsNumber } from 'class-validator';

export class TerminateLeaseDto {
  @ApiProperty({ example: '2026-12-31', required: false })
  @IsOptional()
  @IsDateString()
  termination_date?: string;

  @ApiProperty({ example: 'Tenant vacated unit', required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ example: 5000, required: false, description: 'Amount to deduct from the held deposit' })
  @IsOptional()
  @IsNumber()
  deposit_deduction?: number;
}
