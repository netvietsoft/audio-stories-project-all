import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AppConfigService } from '../shared/config/app-config.service';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

type UploadedAudioFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type AudioUploadFolder = 'chapters' | 'bgm' | 'music';

export type R2UploadFolder = AudioUploadFolder | 'music-thumbnails';

const R2_UPLOAD_FOLDERS: Record<R2UploadFolder, string> = {
  chapters: 'audio/chapters',
  bgm: 'audio/bgm',
  music: 'audio/music',
  'music-thumbnails': 'images/music',
};

@Injectable()
export class AudioUploadService {
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

  async uploadAudio(file: UploadedAudioFile, folder: AudioUploadFolder = 'chapters'): Promise<string> {
    return this.uploadToR2(file, folder);
  }

  async uploadMusicThumbnail(file: UploadedAudioFile): Promise<string> {
    return this.uploadToR2(file, 'music-thumbnails');
  }

  /**
   * Xoá 1 object trên R2 theo URL công khai đã lưu (ảnh thumbnail hoặc audio —
   * cùng bucket). Bỏ qua AN TOÀN nếu URL không thuộc domain R2 (vd URL
   * UploadThing cũ) → không xoá, không ném lỗi. Dùng chung cho ảnh + audio.
   */
  async deleteByUrl(url: string): Promise<void> {
    if (!url) return;
    const prefix = `${this.publicBaseUrl}/`;
    if (!url.startsWith(prefix)) return; // không phải file R2 → không xoá
    const key = url.slice(prefix.length).split('?')[0];
    if (!key) return;

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
    } catch (error) {
      console.error(
        '[AudioUploadService] Failed to delete R2 object',
        { bucket: this.bucketName, key },
        error,
      );
      throw new InternalServerErrorException('Failed to delete file from Cloudflare R2');
    }
  }

  private async uploadToR2(file: UploadedAudioFile, folder: R2UploadFolder): Promise<string> {
    const extension = this.getExtension(file.originalname, file.mimetype);
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const folderPath = R2_UPLOAD_FOLDERS[folder];
    const key = `${folderPath}/${fileName}`;

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
        folder,
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
        : 'Failed to upload file to Cloudflare R2';

      // Keep a structured log for operators, while returning a useful message to the client.
      console.error('[AudioUploadService] Failed to upload file to Cloudflare R2', details, error);

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
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/aac': 'aac',
      'audio/mp4': 'm4a',
      'audio/webm': 'webm',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };

    return mimeToExt[mimetype] ?? 'mp3';
  }
}
