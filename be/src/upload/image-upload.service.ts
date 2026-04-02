import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UTApi } from 'uploadthing/server';

type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class ImageUploadService {
  private readonly utapi: UTApi;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('UPLOADTHING_TOKEN');

    if (!token) {
      throw new BadRequestException('Missing UPLOADTHING_TOKEN configuration');
    }

    this.utapi = new UTApi({ token });
  }

  async uploadImage(file: UploadedImageFile): Promise<string> {
    const extension = this.getExtension(file.originalname, file.mimetype);
    const fileName = `${Date.now()}-${file.originalname}`;

    try {
      // Convert buffer to File object for UploadThing
      // Use Uint8Array to avoid Buffer type issues
      const uint8Array = new Uint8Array(file.buffer);
      const blob = new Blob([uint8Array], { type: file.mimetype });
      const uploadFile = new File([blob], fileName, { type: file.mimetype });

      const response = await this.utapi.uploadFiles(uploadFile);

      if (!response.data || response.error) {
        throw new InternalServerErrorException(
          `UploadThing error: ${response.error?.message || 'Unknown error'}`,
        );
      }

      return response.data.url;
    } catch (error) {
      console.error('Failed to upload image to UploadThing:', error);
      throw new InternalServerErrorException('Failed to upload image to UploadThing');
    }
  }

  private getExtension(originalname: string, mimetype: string): string {
    const rawExt = originalname.split('.').pop()?.toLowerCase();
    if (rawExt) {
      return rawExt;
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };

    return mimeToExt[mimetype] ?? 'jpg';
  }
}
