import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'Sample Site', description: 'Name of the site' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'New York',
    description: 'City where the site is located',
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Manhattan', description: 'Subcity or district' })
  @IsString()
  @IsNotEmpty()
  subcity: string;

  @ApiProperty({
    example: 'Addis Ababa',
    description: 'Location or address of the site',
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ required: false, example: 'SIT-001' })
  @IsString()
  code?: string;

  @ApiProperty({ required: false, example: '123 Main St' })
  @IsString()
  address?: string;

  @ApiProperty({ required: false, example: 'America/New_York' })
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false, example: 'USD' })
  @IsString()
  currency?: string;

  @ApiProperty({ required: false, example: 'contact@site.com' })
  @IsString()
  contact_email?: string;

  @ApiProperty({ required: false, example: 'Some extra notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, description: 'Optional image cover' })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({ required: false, description: 'Optional Site Admin assignment' })
  @IsString()
  @IsOptional()
  manager_id?: string;
}
