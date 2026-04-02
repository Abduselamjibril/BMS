import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { AssetCategory, AssetCondition } from '../entities/asset.entity';

export class CreateAssetDto {
  @ApiProperty({ description: 'Asset name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Category',
    enum: AssetCategory,
    default: AssetCategory.OTHER,
  })
  @IsEnum(AssetCategory)
  @IsOptional()
  category?: AssetCategory;

  @ApiProperty({
    description: 'Condition',
    enum: AssetCondition,
    default: AssetCondition.GOOD,
  })
  @IsEnum(AssetCondition)
  @IsOptional()
  condition?: AssetCondition;

  @ApiProperty({ description: 'Monetary value', required: false })
  @IsNumber()
  @IsOptional()
  value?: number;

  @ApiProperty({ description: 'Purchase date', required: false })
  @IsDateString()
  @IsOptional()
  purchase_date?: string;

  @ApiProperty({ description: 'Image URL', required: false })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({ description: 'Notes or description', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Building ID', required: false })
  @IsUUID()
  @IsOptional()
  buildingId?: string;

  @ApiProperty({ description: 'Unit ID', required: false })
  @IsUUID()
  @IsOptional()
  unitId?: string;
}
