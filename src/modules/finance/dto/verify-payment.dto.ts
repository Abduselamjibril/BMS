import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({
    description: 'Verification status',
    enum: ['confirmed', 'rejected'],
  })
  @IsEnum(['confirmed', 'rejected'])
  status!: 'confirmed' | 'rejected';

  @ApiProperty({
    description: 'Reason for rejection (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
