import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, MinLength } from 'class-validator';

export class CreateOwnerDto {
  @ApiProperty({ description: 'Owner name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Email (required — used as login credential)' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: 'Phone', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Profile Image', required: false })
  @IsString()
  @IsOptional()
  profile_image?: string;

  @ApiProperty({ description: 'Password for the owner login account' })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;
}
