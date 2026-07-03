import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { UserClaimsService } from './user-claims.service';

export interface TokenPair {
  access: string;
  refresh: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly userClaimsService: UserClaimsService,
  ) { }

  /** Returns a JWT secret from env, throwing if missing/too short — never sign with an empty secret. */
  private requireSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
    const value = process.env[name];
    if (!value || value.length < 32) {
      throw new Error(`${name} is not configured (must be set, ≥ 32 chars)`);
    }
    return value;
  }

  async issueTokens(userId: string): Promise<TokenPair> {
    const accessPayload = await this.userClaimsService.buildUserClaims(userId);
    const refreshJti = randomUUID();

    const access = await this.jwt.signAsync(accessPayload as any, {
      secret: this.requireSecret('JWT_ACCESS_SECRET'),
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
    } as any);

    const refresh = await this.jwt.signAsync(
      { sub: userId, jti: refreshJti } as any,
      {
        secret: this.requireSecret('JWT_REFRESH_SECRET'),
        expiresIn: process.env.JWT_REFRESH_TTL || '30d',
      } as any,
    );

    // Store jti (UUID) directly — JWT signature already guarantees integrity.
    // O(1) lookup via unique jti index, no argon2 hash needed.
    await this.prisma.refreshToken.create({
      data: {
        userId,
        jti: refreshJti,
        expiresAt: new Date(Date.now() + this.parseTTL(process.env.JWT_REFRESH_TTL || '30d')),
      },
    });

    return { access, refresh };
  }

  async rotateRefresh(oldToken: string): Promise<TokenPair> {
    // Step 1: Verify JWT signature — rejects tampered/expired tokens
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; jti: string }>(oldToken, {
        secret: this.requireSecret('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Malformed refresh token: missing jti');
    }

    // Step 2: O(1) DB lookup — single indexed query instead of full table scan + argon2.verify loop
    const record = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });

    if (!record) {
      // Token already rotated or revoked — possible token replay attack
      this.logger.warn(`Refresh token not found for jti=${payload.jti} userId=${payload.sub}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.userId !== payload.sub) {
      // jti belongs to a different user — something is very wrong
      this.logger.warn(`jti userId mismatch: record.userId=${record.userId} payload.sub=${payload.sub}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { jti: payload.jti } });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Step 3: Rotate — delete old record then issue new pair atomically
    await this.prisma.refreshToken.delete({ where: { jti: payload.jti } });
    return this.issueTokens(payload.sub);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  parseTTL(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/i);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || 0);
  }
}
