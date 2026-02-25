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
}
