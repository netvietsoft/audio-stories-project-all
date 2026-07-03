import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

import { AppConfigService } from '../shared/config/app-config.service';

type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

// Ảnh upload chung (chapter thumbnail, story cover, banner…) đều vào folder này trên R2.
const IMAGE_UPLOAD_FOLDER = 'images/uploads';

/**
 * Upload ảnh lên Cloudflare R2 (S3-compatible) — thay UploadThing.
 * Dùng chung cấu hình R2 với AudioUploadService (env R2_*). URL trả về là
 * `${R2_URL}/images/uploads/<file>` (public domain R2).
 */
@Injectable()
export class ImageUploadService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly cfg: AppConfigService) {
    const endpoint = this.cfg.storage.r2.endpoint;
    const accessKeyId = this.cfg.storage.r2.accessKeyId;
    const secretAccessKey = this.cfg.storage.r2.secretAccessKey;
    const bucketName = this.cfg.storage.r2.bucketName;
    const publicBaseUrl = this.cfg.storage.r2.url;

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
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const key = `${IMAGE_UPLOAD_FOLDER}/${fileName}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return `${this.publicBaseUrl}/${key}`;
    } catch (error) {
      const awsError = error as {
        name?: string;
        message?: string;
        code?: string;
        $metadata?: { httpStatusCode?: number; requestId?: string; extendedRequestId?: string };
      };

      const details = {
        bucket: this.bucketName,
        key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        awsName: awsError?.name,
        awsCode: awsError?.code,
        httpStatusCode: awsError?.$metadata?.httpStatusCode,
        requestId: awsError?.$metadata?.requestId,
        extendedRequestId: awsError?.$metadata?.extendedRequestId,
        awsMessage: awsError?.message,
      };

      const isInvalidBucketName =
        awsError?.name === 'InvalidBucketName' ||
        awsError?.code === 'InvalidBucketName' ||
        /bucket name/i.test(awsError?.message || '');

      const message = isInvalidBucketName
        ? 'R2 bucket name is invalid. Cloudflare R2 bucket names cannot contain underscores. Please rename the bucket (for example: audio-truyen-r2) and update R2_BUCKET_NAME.'
        : 'Failed to upload image to Cloudflare R2';

      console.error('[ImageUploadService] Failed to upload image to Cloudflare R2', details, error);

      throw new InternalServerErrorException({
        message,
        details,
      });
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
