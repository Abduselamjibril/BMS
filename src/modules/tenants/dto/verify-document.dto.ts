import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';

export class VerifyDocumentDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  verified!: boolean;

  @ApiProperty({ required: false, example: 'Photo is unclear' })
  @IsOptional()
  @ValidateIf((obj) => obj.verified === false)
  @IsString()
  reject_reason?: string;
}
