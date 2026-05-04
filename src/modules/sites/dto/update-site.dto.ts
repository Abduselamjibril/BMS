import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateSiteDto } from './create-site.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSiteDto extends PartialType(CreateSiteDto) {
  @ApiProperty({ required: false, description: 'Optional Site Admin assignment' })
  @IsString()
  @IsOptional()
  manager_id?: string;
}
