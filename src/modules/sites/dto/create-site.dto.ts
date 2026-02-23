import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'Sample Site', description: 'Name of the site' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'New York', description: 'City where the site is located' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Manhattan', description: 'Subcity or district' })
  @IsString()
  @IsNotEmpty()
  subcity: string;

  @ApiProperty({ example: '40.7128,-74.0060', description: 'Latitude and longitude of the site' })
  @IsString()
  @IsNotEmpty()
  location_lat_long: string;
}
