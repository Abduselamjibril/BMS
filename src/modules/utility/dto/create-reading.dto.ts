import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateReadingDto {
  @ApiProperty({ example: 'meter-uuid' })
  @IsString()
  @IsNotEmpty()
  meter_id!: string;

  @ApiProperty({ example: 12345.67 })
  @IsNumber()
  reading_value!: number;

  @ApiProperty({ example: '2026-02-01', required: false })
  @IsOptional()
  @IsString()
  reading_date?: string;

  @ApiProperty({ example: '/uploads/meters/123.png', required: false })
  @IsOptional()
  @IsString()
  photo_url?: string;
}
