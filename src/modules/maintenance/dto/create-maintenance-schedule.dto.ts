import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString, IsUUID, IsBoolean } from 'class-validator';

export class CreateMaintenanceScheduleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  priority: string;

  @IsNumber()
  @IsNotEmpty()
  frequency_days: number;

  @IsDateString()
  @IsNotEmpty()
  next_due_date: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  building_id?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
