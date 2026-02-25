import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Admin user ID who verifies the payment' })
  verified_by!: string;

  @ApiProperty({ description: 'Verification status', enum: ['confirmed', 'rejected'] })
  status!: 'confirmed' | 'rejected';
}
