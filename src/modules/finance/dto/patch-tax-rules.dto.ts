import { ApiProperty } from '@nestjs/swagger';

export class PatchTaxRulesDto {
  @ApiProperty({ description: 'VAT rate', example: 0.15 })
  vat_rate!: number;

  @ApiProperty({ description: 'Withholding rate', example: 0.02 })
  withholding_rate!: number;
}
