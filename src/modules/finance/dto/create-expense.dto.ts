import { IsNumber, IsString, IsNotEmpty, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class CreateExpenseDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  building_id?: string;

  @IsUUID()
  @IsOptional()
  bank_account_id?: string;

  @IsString()
  @IsOptional()
  receipt_url?: string;
}
