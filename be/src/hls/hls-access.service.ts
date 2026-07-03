import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { HlsKeyService, HlsAssetTypeName } from './hls-key.service';
import {
  checkChapterEntitlement,
  checkMusicEntitlement,
  checkVariantEntitlement,
} from './hls-entitlement';

/**
 * Authorization + key serving for the HLS key endpoint — the single security
 * gate for encrypted HLS audio. Entitlement is read-only (red-team C2).
 */
@Injectable()
export class HlsAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keyService: HlsKeyService,
  ) {}

  /** True if the caller may obtain the content key for this asset. */
  authorize(
    assetType: HlsAssetTypeName,
    assetId: string,
    userId?: string,
  ): Promise<boolean> {
    switch (assetType) {
      case 'chapter':
        return checkChapterEntitlement(this.prisma, assetId, userId);
      case 'variant':
        return checkVariantEntitlement(this.prisma, assetId, userId);
      case 'music':
        return checkMusicEntitlement(this.prisma, assetId, userId);
    }
  }

  /**
   * Return the raw 16-byte AES-128 content key. Throws NotFound if the asset is
   * missing or not yet `ready`. Key is unwrapped in RAM only (never logged).
   */
  async serveKey(
    assetType: HlsAssetTypeName,
    assetId: string,
  ): Promise<Buffer> {
    const asset = await this.prisma.hlsAsset.findUnique({
      where: { assetType_assetId: { assetType, assetId } },
      select: { status: true, encKey: true },
    });
    if (!asset || asset.status !== 'ready') {
      throw new NotFoundException('HLS asset not available');
    }
    return this.keyService.unwrapKey(
      Buffer.from(asset.encKey),
      assetType,
      assetId,
    );
  }
}
