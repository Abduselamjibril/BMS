import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber } from 'class-validator';
import { CreateBuildingDto } from './create-building.dto';
import { BuildingType, BuildingStatus } from '../entities/building.entity';

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

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsEnum(BuildingStatus)
  @IsOptional()
  status?: BuildingStatus;
}
