import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { BillingCycle } from '../entities/lease.entity';

export class RenewLeaseDto {
  @ApiProperty({ example: '2027-03-01' })
  @IsDateString()
  start_date!: string;

  @ApiProperty({ example: '2028-02-29' })
  @IsDateString()
  end_date!: string;

  @ApiProperty({ example: 55000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rent_amount?: number;

  @ApiProperty({ example: 6000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  service_charge?: number;

  @ApiProperty({
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
    required: false,
  })
  @IsOptional()
  @IsEnum(BillingCycle)
  billing_cycle?: BillingCycle;
}
