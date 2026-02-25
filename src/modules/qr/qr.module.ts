import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QRCode } from './entities/qr-code.entity';
import { QRScanLog } from './entities/qr-scan-log.entity';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { Unit } from '../units/entities/unit.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QRCode, QRScanLog, Unit, UserRole])],
  providers: [QrService],
  controllers: [QrController],
  exports: [QrService],
})
export class QrModule {}
