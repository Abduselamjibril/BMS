import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';

export class CreateBankAccountDto {
  @ApiProperty()
  @IsString()
  bank_name!: string;

  @ApiProperty()
  @IsString()
  account_number!: string;

  @ApiProperty()
  @IsString()
  branch!: string;

  @ApiProperty({ example: 1000.0, description: 'Initial opening balance' })
  @IsNumber()
  opening_balance!: number;
}
