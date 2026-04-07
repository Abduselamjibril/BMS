import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsUUID()
  invoice_id!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty()
  @IsString()
  reference_no!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proof_url?: string;

  @ApiProperty({ example: 'a7d4c5e4-1a1a-413a-aa3d-4c362020d3e8', description: 'Selected bank account ID' })
  @IsUUID()
  @IsOptional()
  bank_account_id?: string;
}
