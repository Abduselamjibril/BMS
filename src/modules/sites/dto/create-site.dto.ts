import { ApiProperty } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({ example: 'Sample Site', description: 'Name of the site' })
  name: string;

  @ApiProperty({ example: 'New York', description: 'City where the site is located' })
  city: string;

  @ApiProperty({ example: 'Manhattan', description: 'Subcity or district' })
  subcity: string;

  @ApiProperty({ example: '40.7128,-74.0060', description: 'Latitude and longitude of the site' })
  location_lat_long: string;
}
