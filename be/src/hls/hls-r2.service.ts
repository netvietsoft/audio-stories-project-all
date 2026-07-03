import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { AppConfigService } from '@/shared/config/app-config.service';
import { HlsAssetTypeName } from './hls-key.service';
import { PLAYLIST_FILENAME } from './hls-transcode.service';

const HLS_ROOT = 'audio/hls';
const SEGMENT_CONTENT_TYPE = 'video/mp2t';
const PLAYLIST_CONTENT_TYPE = 'application/vnd.apple.mpegurl';

export interface UploadResult {
  playlistUrl: string;
  prefix: string;
}

/**
 * R2 (S3-compatible) I/O for HLS: stream the source mp3 down, upload the
 * generated playlist + segments, and prune superseded versions. Builds its own
 * S3 client from the same R2 config the upload module uses.
 */
@Injectable()
export class HlsR2Service {
  private readonly logger = new Logger(HlsR2Service.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(cfg: AppConfigService) {
    const { endpoint, accessKeyId, secretAccessKey, bucketName, url } =
      cfg.storage.r2;
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName || !url) {
      throw new BadRequestException(
        'Missing required Cloudflare R2 configuration',
      );
    }
    this.bucket = bucketName;
    this.publicBaseUrl = url.replace(/\/$/, '');
    this.s3 = new S3Client({
      endpoint,
      region: 'auto',
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /** Object key for a source URL (strips the public base or falls back to URL path). */
  private sourceKey(sourceUrl: string): string {
    if (sourceUrl.startsWith(`${this.publicBaseUrl}/`)) {
      return sourceUrl.slice(this.publicBaseUrl.length + 1);
    }
    try {
      return new URL(sourceUrl).pathname.replace(/^\/+/, '');
    } catch {
      return sourceUrl.replace(/^\/+/, '');
    }
  }

  /**
   * Tải audio nguồn về file tạm để ffmpeg đọc.
   * - URL thuộc R2 public của ta -> GetObject (hỗ trợ cả bucket private).
   * - URL NGOÀI R2 (UploadThing, soundhelix, CDN khác...) -> tải qua HTTP(S).
   * Nhờ vậy HLS chạy được cho cả music (R2) lẫn truyện (nguồn ngoài).
   */
  async downloadToFile(sourceUrl: string, destPath: string): Promise<void> {
    if (sourceUrl.startsWith(`${this.publicBaseUrl}/`)) {
      const Key = this.sourceKey(sourceUrl);
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key }),
      );
      if (!res.Body) {
        throw new InternalServerErrorException(`R2 source has no body: ${Key}`);
      }
      await pipeline(res.Body as Readable, createWriteStream(destPath));
      return;
    }

    const response = await fetch(sourceUrl);
    if (!response.ok || !response.body) {
      throw new InternalServerErrorException(
        `Không tải được audio nguồn (HTTP ${response.status}): ${sourceUrl}`,
      );
    }
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(destPath),
    );
  }

  /**
   * Upload segments FIRST, then the playlist LAST (red-team C6): a crash mid-
   * upload never leaves a readable playlist referencing missing segments.
   * Output goes under a versioned prefix so re-transcode never overwrites the
   * version currently being played.
   */
  async uploadPlaylist(
    workDir: string,
    segmentFiles: string[],
    assetType: HlsAssetTypeName,
    assetId: string,
    runId: string,
  ): Promise<UploadResult> {
    const prefix = `${HLS_ROOT}/${assetType}/${assetId}/${runId}`;

    for (const seg of segmentFiles) {
      await this.putObject(
        `${prefix}/${seg}`,
        await readFile(join(workDir, seg)),
        SEGMENT_CONTENT_TYPE,
      );
    }
    // Playlist last — only now is the asset playable.
    const playlistBody = await readFile(join(workDir, PLAYLIST_FILENAME));
    await this.putObject(
      `${prefix}/${PLAYLIST_FILENAME}`,
      playlistBody,
      PLAYLIST_CONTENT_TYPE,
    );

    this.logger.log(
      `uploaded ${segmentFiles.length} segments + playlist to ${prefix}`,
    );
    return {
      playlistUrl: `${this.publicBaseUrl}/${prefix}/${PLAYLIST_FILENAME}`,
      prefix,
    };
  }

  /** Delete every version under the asset except {@link keepRunId} (red-team V3). */
  async cleanupOldVersions(
    assetType: HlsAssetTypeName,
    assetId: string,
    keepRunId: string,
  ): Promise<void> {
    const assetPrefix = `${HLS_ROOT}/${assetType}/${assetId}/`;
    const keep = `${assetPrefix}${keepRunId}/`;
    let token: string | undefined;
    const toDelete: { Key: string }[] = [];
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: assetPrefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of page.Contents ?? []) {
        if (obj.Key && !obj.Key.startsWith(keep))
          toDelete.push({ Key: obj.Key });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    if (toDelete.length === 0) return;
    // DeleteObjects caps at 1000 keys/request.
    for (let i = 0; i < toDelete.length; i += 1000) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: toDelete.slice(i, i + 1000) },
        }),
      );
    }
    this.logger.log(
      `cleaned ${toDelete.length} stale object(s) under ${assetPrefix}`,
    );
  }

  private async putObject(
    Key: string,
    Body: Buffer,
    ContentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key, Body, ContentType }),
    );
  }
}
