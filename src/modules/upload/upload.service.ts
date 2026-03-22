import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class UploadService {
  // Not used directly, but kept for possible future extension
  uploadFile(file: Express.Multer.File) {
    return {
      originalname: file.originalname,
      filename: file.filename,
      size: file.size,
    };
  }

  async deleteFile(filename: string): Promise<boolean> {
    const filePath = join(process.cwd(), 'uploads', 'buildings', filename);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      return false;
    }
  }
}
