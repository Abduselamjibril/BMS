import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UploadLeaseDocDto {
  @ApiProperty({ example: '/public/buildings/signed-lease.pdf' })
  @IsString()
  @IsNotEmpty()
  doc_path!: string;
}
