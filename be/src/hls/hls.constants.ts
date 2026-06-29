import type { HlsAssetTypeName } from './hls-key.service';

/** BullMQ queue name for HLS transcode jobs. */
export const HLS_TRANSCODE_QUEUE = 'hls-transcode';

/**
 * BullMQ key prefix — isolates queue keys from the shared cache-manager Redis
 * (same REDIS_URL / db 0) so neither evicts the other (red-team H4).
 */
export const HLS_BULL_PREFIX = 'hls-bull';

/** Payload for a single transcode job. */
export interface HlsTranscodeJob {
  assetType: HlsAssetTypeName;
  assetId: string;
  /** R2 source URL of the original mp3 (`${publicBaseUrl}/${key}`). */
  sourceUrl: string;
  /** Id of the HlsAsset row to update with the result. */
  hlsAssetId: string;
}

/** Deterministic jobId so repeated enqueues for one asset dedupe. */
export const hlsJobId = (
  assetType: HlsAssetTypeName,
  assetId: string,
): string => `${assetType}:${assetId}`;
