import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateAmenityDto {
  @ApiProperty({ description: 'Amenity name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Amenity description', required: false })
  @IsString()
  description?: string;
}
