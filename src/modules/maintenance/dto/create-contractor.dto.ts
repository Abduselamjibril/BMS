import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateContractorDto {
  @ApiProperty({
    description: 'Contractor Name',
    example: 'FixIt Plumbing Services',
  })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Contractor Phone', example: '+251911223344' })
  @IsString()
  phone!: string;

  @ApiProperty({
    description: 'Contractor Specialization',
    example: 'plumbing',
  })
  @IsString()
  specialization!: string;

  @ApiProperty({
    description: 'Contact Person',
    example: 'John Fix',
    required: false,
  })
  @IsString()
  @IsOptional()
  contact_person?: string;

  @ApiProperty({
    description: 'Contact Email',
    example: 'fixit@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}
