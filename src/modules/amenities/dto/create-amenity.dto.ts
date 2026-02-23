import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateAmenityDto {
  @ApiProperty({ description: 'Amenity name', example: 'Swimming Pool' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Amenity description', required: false, example: 'Olympic size pool' })
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Amenity category', example: 'leisure' })
  @IsString()
  @IsNotEmpty()
  category!: string;
}
