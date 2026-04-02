import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey =
      this.configService.get<string>('R2_SECRET_ACCESS_KEY') || this.configService.get<string>('R2_SECRET_KEY_ID');
    const bucketName = this.configService.get<string>('R2_BUCKET_NAME');
    const publicBaseUrl =
      this.configService.get<string>('R2_PUBLIC_URL') ||
      this.configService.get<string>('R2_CUSTOM_DOMAIN') ||
      this.configService.get<string>('R2_URL');

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
      throw new BadRequestException('Missing required Cloudflare R2 configuration');
    }

    this.bucketName = bucketName;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');

    this.s3Client = new S3Client({
      endpoint,
      region: 'auto',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadImage(file: UploadedImageFile): Promise<string> {
    const extension = this.getExtension(file.originalname, file.mimetype);
    const baseName = file.originalname
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const fileName = `${Date.now()}-${baseName || 'image'}.${extension}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return `${this.publicBaseUrl}/${fileName}`;
    } catch {
      throw new InternalServerErrorException('Failed to upload image to Cloudflare R2');
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
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
      'image/svg+xml': 'svg',
    };

    return mimeToExt[mimetype] ?? 'jpg';
  }
}
