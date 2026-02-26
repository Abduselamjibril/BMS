import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Verification status', enum: ['confirmed', 'rejected'] })
  status!: 'confirmed' | 'rejected';
}
