import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword123!' })
  @IsNotEmpty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
