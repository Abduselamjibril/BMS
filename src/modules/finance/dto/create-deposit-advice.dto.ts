import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsDateString, IsString, IsOptional } from 'class-validator';

export class CreateDepositAdviceDto {
  @ApiProperty()
  @IsUUID()
  bank_account_id!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty()
  @IsDateString()
  deposit_date!: string;

  @ApiProperty()
  @IsString()
  reference_no!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  proof_url?: string;
}
