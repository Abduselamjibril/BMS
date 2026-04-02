import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { CreateBuildingDto } from './create-building.dto';
import { BuildingType } from '../entities/building.entity';

export class UpdateBuildingDto extends PartialType(CreateBuildingDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  siteId?: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsEnum(BuildingType)
  @IsOptional()
  type?: BuildingType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image_url?: string;
}
