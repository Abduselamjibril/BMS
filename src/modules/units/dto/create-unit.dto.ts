import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { UnitType } from '../entities/unit.entity';

export class CreateUnitDto {
  @ApiProperty({ description: 'Unit number' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @ApiProperty({ description: 'Unit type', enum: UnitType })
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiProperty({ description: 'Floor', required: false, type: Number })
  @IsOptional()
  floor?: number;

  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
