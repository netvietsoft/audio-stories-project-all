import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

type UploadedAudioFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type AudioUploadFolder = 'chapters' | 'bgm';

const AUDIO_UPLOAD_FOLDERS: Record<AudioUploadFolder, string> = {
  chapters: 'audio/chapters',
  bgm: 'audio/bgm',
};

@Injectable()
export class AudioUploadService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_KEY_ID');
    const bucketName = this.configService.get<string>('R2_BUCKET_NAME');
    const publicBaseUrl = this.configService.get<string>('R2_URL');

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
    const extension = this.getExtension(file.originalname, file.mimetype);
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const folderPath = AUDIO_UPLOAD_FOLDERS[folder];
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
      throw new InternalServerErrorException('Failed to upload audio to Cloudflare R2');
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
    };

    return mimeToExt[mimetype] ?? 'mp3';
  }
}
