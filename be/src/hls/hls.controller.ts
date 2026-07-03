import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { OptionalJwtGuard } from '@/auth/guards/optional-jwt.guard';
import { HLS_ASSET_TYPES, HlsAssetTypeName } from './hls-key.service';
import { HlsAccessService } from './hls-access.service';

function isHlsAssetType(value: string): value is HlsAssetTypeName {
  return (HLS_ASSET_TYPES as readonly string[]).includes(value);
}

@ApiTags('HLS')
@Controller('hls')
export class HlsController {
  constructor(private readonly access: HlsAccessService) {}

  /**
   * AES-128 key endpoint — the single gate for encrypted HLS audio.
   *  - invalid assetType → 400 (no path-controlled authz branch, red-team H6)
   *  - not entitled       → 403
   *  - asset not ready    → 404
   * Tighter throttle than the global default to blunt key-oracle / id
   * enumeration (red-team H6).
   */
  @ApiOperation({ summary: 'Lấy khóa AES-128 giải mã HLS theo quyền truy cập' })
  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':assetType/:assetId/key')
  async getKey(
    @Param('assetType') assetType: string,
    @Param('assetId') assetId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!isHlsAssetType(assetType)) {
      throw new BadRequestException('Invalid asset type');
    }
    const userId = (req.user as { id?: string } | undefined)?.id;

    const allowed = await this.access.authorize(assetType, assetId, userId);
    if (!allowed) {
      throw new ForbiddenException('Not entitled to this content');
    }

    const key = await this.access.serveKey(assetType, assetId);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.send(key);
  }
}
