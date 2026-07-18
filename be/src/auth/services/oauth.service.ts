import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UserClaimsService } from './user-claims.service';
import * as geoip from 'geoip-lite';

import { User } from '@prisma/client';

export interface GoogleUserData {
  provider: 'google';
  provider_user_id: string;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  raw?: Record<string, unknown>;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  private async ensureDefaultUserRoleId(): Promise<number> {
    const role = await this.prisma.role.upsert({
      where: { slug: 'user' },
      update: {},
      create: {
        name: 'USER',
        slug: 'user',
        description: 'Default user role',
      },
    });

    return role.id;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly userClaimsService: UserClaimsService,
  ) { }

  async upsertGoogleUser(google: GoogleUserData, ip?: string): Promise<User> {
    if (!google.email) {
      throw new UnauthorizedException('Google account lacks email');
    }

    // Security: only trust an email Google itself has verified. Otherwise an attacker
    // with an unverified Google account could link to / take over a local account that
    // happens to share the same email address. (raw = profile._json ở web flow,
    // TokenPayload ở mobile — cả hai đều có email_verified: boolean.)
    if ((google.raw as any)?.email_verified !== true) {
      throw new UnauthorizedException('Google email is not verified');
    }

    let user = await this.prisma.user.findUnique({ where: { email: google.email } });
    const isNewUser = !user;

    // Resolve country if provided
    let country: string | null = null;
    if (ip) {
      const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
      const isPrivate = ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
      
      if (!isLocalhost && !isPrivate) {
        const geo = geoip.lookup(ip);
        if (geo) {
          country = geo.country;
        }
      }
    }

    if (!user) {
      const defaultRoleId = await this.ensureDefaultUserRoleId();

      user = await this.prisma.user.create({
        data: {
          email: google.email,
          displayName: google.name || '',
          googleId: google.provider_user_id,
          avatarUrl: google.avatar_url,
          country: country,
          roleId: defaultRoleId,
        },
      });
    } else {
      const updateData: any = {};
      if (!user.emailVerifiedAt) {
        updateData.emailVerifiedAt = new Date();
        // Chống account pre-hijack: account này đăng ký bằng password nhưng CHƯA từng
        // verify email — password đó không đáng tin (có thể do kẻ khác đặt trước bằng
        // email của nạn nhân). Google vừa xác nhận chủ email thật → vô hiệu password cũ;
        // chủ account cần password thì đặt lại qua forgot-password (email đã verify).
        if (user.passwordHash) updateData.passwordHash = null;
      }
      if (google.name && !user.displayName) updateData.displayName = google.name;
      if (google.avatar_url && !user.avatarUrl) updateData.avatarUrl = google.avatar_url;
      if (!user.googleId) updateData.googleId = google.provider_user_id;
      // Backfill country if missing
      if (!user.country && country) updateData.country = country;

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({ where: { id: user.id }, data: updateData });
      }
    }

    if (isNewUser) {
      await this.userClaimsService.assignDefaultRole(user.id);
    }

    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: 'google', providerUserId: google.provider_user_id } },
    });

    if (!existingOAuth) {
      await this.prisma.oAuthAccount.create({
        data: {
          provider: 'google',
          providerUserId: google.provider_user_id,
          userId: user.id,
          profile: google as any,
        },
      });
    }

    return user;
  }
}
