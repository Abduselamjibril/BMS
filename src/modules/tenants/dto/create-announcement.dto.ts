import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AnnouncementTarget } from '../entities/announcement.entity';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Water Maintenance' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Water will be unavailable from 2PM to 4PM.' })
  @IsString()
  message!: string;

  @ApiProperty({ enum: AnnouncementTarget })
  @IsEnum(AnnouncementTarget)
  target!: AnnouncementTarget;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  building_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  site_id?: string;
}
