import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';

import { UtilityService } from './utility.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { CreateReadingDto } from './dto/create-reading.dto';
import { Auth } from '../../common/decorators/auth.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('utilities')
@Controller('utilities')
@Auth()
export class UtilityController {
  constructor(private readonly utilityService: UtilityService) {}

  @Get('/alerts/utility-leaks')
  @Permissions('utilities:alerts:read')
  @ApiOperation({
    summary:
      'List units/meters with abnormal utility consumption (possible leaks)',
  })
  async getUtilityLeaks() {
    return this.utilityService.getUtilityLeaks();
  }

  @Post('meters')
  @Permissions('utilities:meters:create')
  @ApiOperation({ summary: 'Link a physical meter to a unit' })
  async createMeter(@Body() dto: CreateMeterDto, @Req() req: any) {
    return this.utilityService.createMeter(dto, req.user);
  }

  @ApiQuery({ name: 'unit_id', required: false, type: String, description: 'Filter by unit UUID' })
  @ApiQuery({ name: 'building_id', required: false, type: String, description: 'Filter by building UUID' })
  @ApiQuery({ name: 'site_id', required: false, type: String, description: 'Filter by site UUID' })
  @Get('meters')
  @Permissions('utilities:meters:read')
  @ApiOperation({ summary: 'List meters; optional unit_id query' })
  async findMeters(
    @Req() req: any,
    @Query('unit_id') unitId?: string,
    @Query('building_id') buildingId?: string,
    @Query('site_id') siteId?: string,
  ) {
    // Basic validation for incoming UUID query params
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (unitId && !uuidRegex.test(unitId)) throw new BadRequestException('Invalid unit_id');
    if (buildingId && !uuidRegex.test(buildingId)) throw new BadRequestException('Invalid building_id');
    if (siteId && !uuidRegex.test(siteId)) throw new BadRequestException('Invalid site_id');

    try {
      return await this.utilityService.findMeters(req.user, unitId, buildingId, siteId);
    } catch (err: any) { // Change to 'any' or cast inside the block
      // Log server-side
      // eslint-disable-next-line no-console
      console.error('utility.findMeters error', { 
        err: err?.message || err, 
        unitId, 
        buildingId, 
        siteId 
      });

      // Return the underlying error message in the HTTP response
      const message = err?.message || 'Internal server error';
      const errorType = err?.name || 'InternalServerError';

      throw new HttpException(
        { statusCode: 500, message, error: errorType }, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('readings')
  @Permissions('utilities:readings:create')
  @ApiOperation({
    summary: 'Record a meter reading (accepts optional photo multipart)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        meter_id: { type: 'string', format: 'uuid' },
        reading_value: { type: 'number' },
        reading_date: { type: 'string', format: 'date-time' },
        photo: { type: 'string', format: 'binary' },
      },
      required: ['meter_id', 'reading_value'],
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/meters',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async createReading(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
    @Req() req: any,
  ) {
    const dto: CreateReadingDto = {
      meter_id: body.meter_id,
      reading_value:
        body.reading_value !== undefined
          ? Number(body.reading_value)
          : undefined,
      reading_date: body.reading_date,
      photo_url: file ? file.path : body.photo_url,
    } as CreateReadingDto;

    return this.utilityService.createReading(dto, req.user);
  }

  @Get('readings')
  @Permissions('utilities:readings:read')
  @ApiOperation({ summary: 'List readings; optional meter_id query' })
  async findReadings(@Req() req: any, @Query('meter_id') meterId?: string) {
    return this.utilityService.findReadings(req.user, meterId);
  }

  @Get('meters/:id')
  @Permissions('utilities:meters:read')
  @ApiOperation({ summary: 'Get details for a specific meter' })
  async findMeter(@Param('id') id: string) {
    return this.utilityService.findMeter(id);
  }
}
