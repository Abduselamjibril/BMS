import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateBuildingDto } from './create-building.dto';

export class UpdateBuildingDto extends PartialType(CreateBuildingDto) {
    @ApiProperty({
        example: {
            name: 'Updated Building Name',
            code: 'BLD-001',
            type: 'residential',
            city: 'Addis Ababa',
            status: 'active'
        },
        required: false
    })
    // This is used for Swagger documentation examples
    _example?: any;
}
