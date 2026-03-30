import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { UnitType, UnitStatus } from '../entities/unit.entity';

export class CreateUnitDto {
  @ApiProperty({ description: 'Unit number', example: '101' })
  @IsString()
  @IsNotEmpty()
  unit_number!: string;

  @ApiProperty({
    description: 'Unit type',
    enum: UnitType,
    example: UnitType.ONE_BEDROOM,
  })
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiProperty({ description: 'Floor', example: 1 })
  @IsNumber()
  floor!: number;

  @ApiProperty({ description: 'Size in square meters', example: 80 })
  @IsNumber()
  size_sqm!: number;

  @ApiProperty({
    description: 'Status',
    enum: UnitStatus,
    example: UnitStatus.VACANT,
  })
  @IsEnum(UnitStatus)
  status!: UnitStatus;

  @ApiProperty({ description: 'Number of bedrooms', example: 1 })
  @IsNumber()
  bedrooms!: number;

  @ApiProperty({ description: 'Number of bathrooms', example: 1 })
  @IsNumber()
  bathrooms!: number;

  @ApiProperty({
    description: 'Building ID',
    example: 'a097e608-8df2-4716-85af-61df209ef5fc',
  })
  @IsString()
  @IsNotEmpty()
  buildingId!: string;

  @ApiProperty({
    description: 'Description',
    required: false,
    example: 'Corner unit',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Unit image URL', required: false })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({ description: 'Rent price', required: false, example: 1200 })
  @IsNumber()
  @IsOptional()
  rent_price?: number;

}
