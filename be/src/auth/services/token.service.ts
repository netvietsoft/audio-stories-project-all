import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
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

  async issueTokens(userId: string): Promise<TokenPair> {
    const accessPayload = await this.userClaimsService.buildUserClaims(userId);
    const refreshJti = randomUUID();

    const access = await this.jwt.signAsync(accessPayload as any, {
      secret: process.env.JWT_ACCESS_SECRET ?? '',
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
    } as any);

    const refresh = await this.jwt.signAsync(
      { sub: userId, jti: refreshJti } as any,
      {
        secret: process.env.JWT_REFRESH_SECRET ?? '',
        expiresIn: process.env.JWT_REFRESH_TTL || '30d',
      } as any,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: userId,
        token: await argon2.hash(refresh),
        expiresAt: new Date(Date.now() + this.parseTTL(process.env.JWT_REFRESH_TTL || '30d')),
      },
    });

    return { access, refresh };
  }

  async rotateRefresh(oldToken: string): Promise<TokenPair> {
    const payload = await this.jwt.verifyAsync<{ sub: string; jti: string }>(oldToken, {
      secret: process.env.JWT_REFRESH_SECRET ?? '',
    });

    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub },
      orderBy: { createdAt: 'desc' },
    });

    let validTokenId: string | null = null;
    for (const t of tokens) {
      if (await argon2.verify(t.token, oldToken)) {
        validTokenId = t.id;
        break;
      }
    }

    if (!validTokenId) throw new UnauthorizedException('Invalid refresh token');

    // Use deleteMany to avoid error when record doesn't exist (race condition)
    await this.prisma.refreshToken.deleteMany({ where: { id: validTokenId } });
    return this.issueTokens(payload.sub);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId: userId } });
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
