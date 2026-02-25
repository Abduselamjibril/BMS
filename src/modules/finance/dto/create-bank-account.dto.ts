import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

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
}
