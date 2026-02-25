import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVisitorDto {
  @ApiProperty({ example: 'site-uuid' })
  @IsString()
  @IsNotEmpty()
  site_id!: string;

  @ApiProperty({ example: 'unit-uuid', required: false })
  @IsOptional()
  @IsString()
  unit_id?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  visitor_name!: string;

  @ApiProperty({ example: '+251911000000', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'ID123456', required: false })
  @IsOptional()
  @IsString()
  id_card_no?: string;
}
