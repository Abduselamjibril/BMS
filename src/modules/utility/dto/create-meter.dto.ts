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

  @ApiProperty({ example: 1.5, required: false })
  @IsOptional()
  @IsNumber()
  unit_price?: number;

  @ApiProperty({ example: 'building-uuid', required: false })
  @IsOptional()
  @IsString()
  building_id?: string;

  @ApiProperty({ example: 'site-uuid', required: false })
  @IsOptional()
  @IsString()
  site_id?: string;
}
