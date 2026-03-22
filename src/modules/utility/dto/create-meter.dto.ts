import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';
import { UtilityType } from '../entities/utility-meter.entity';

export class CreateMeterDto {
  @ApiProperty({ example: 'unit-uuid' })
  @IsString()
  @IsNotEmpty()
  unit_id!: string;

  @ApiProperty({ enum: UtilityType })
  @IsEnum(UtilityType)
  type!: UtilityType;

  @ApiProperty({ example: 'SN-12345', required: false })
  @IsOptional()
  @IsString()
  serial_no?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  initial_reading?: number;
}
