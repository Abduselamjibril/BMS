import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { BuildingType } from '../entities/building.entity';

export class CreateBuildingDto {
  @ApiProperty({
    description: 'Building type',
    enum: BuildingType,
    example: BuildingType.RESIDENTIAL,
  })
  @IsEnum(BuildingType)
  type!: BuildingType;
  @ApiProperty({ description: 'Unique building code', example: 'BLD-001' })
  @IsString()
  @IsNotEmpty()
  code!: string;
  @ApiProperty({ description: 'Building name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Building address' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ description: 'Building description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Building image URL', required: false })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({
    description: 'Site ID',
    example: 'c27caa13-3083-475f-9aa8-9c1219e7c989',
  })
  @IsString()
  @IsNotEmpty()
  siteId!: string;

  @ApiProperty({
    description: 'Owner ID',
    example: '21020a7e-5395-4adb-a459-d0aa44b683d2',
  })
  @IsString()
  @IsNotEmpty()
  ownerId!: string;
}
