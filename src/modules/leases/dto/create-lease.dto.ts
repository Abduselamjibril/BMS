import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { BillingCycle } from '../entities/lease.entity';

export class CreateLeaseDto {
  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty()
  @IsUUID()
  unit_id!: string;

  @ApiProperty()
  @IsUUID()
  building_id!: string;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  start_date!: string;

  @ApiProperty({ example: '2027-02-28' })
  @IsDateString()
  end_date!: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0)
  rent_amount!: number;

  @ApiProperty({ example: 5000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  service_charge?: number;

  @ApiProperty({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle)
  billing_cycle?: BillingCycle;

  @ApiHideProperty()
  @IsOptional()
  @IsNotEmpty()
  doc_path?: string;
}
