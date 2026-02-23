import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty({ example: 'Please share your move-in date confirmation.' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
