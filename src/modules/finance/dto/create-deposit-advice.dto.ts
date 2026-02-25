import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsDateString, IsString } from 'class-validator';

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
}
