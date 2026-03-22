import { ApiProperty } from '@nestjs/swagger';

export class UploadLeaseDocDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Signed lease PDF document',
  })
  file!: any;
}
