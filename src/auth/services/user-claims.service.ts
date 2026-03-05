import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface UserClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface UserInfo {
  sub: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  status: string;
  roles: string[];
  permissions: string[];
  // Premium & download fields (for FE compatibility)
  is_premium: boolean;
  premium_expires_at: Date | null;
  premium_expired: boolean;
  current_package_id: string | null;
  daily_download_count: number;
  monthly_download_count: number;
  daily_download_limit: number;
  monthly_download_limit: number;
}

@Injectable()
export class UserClaimsService {
  private readonly logger = new Logger(UserClaimsService.name);

  constructor(private readonly prisma: PrismaService) { }

  async buildUserClaims(userId: string): Promise<UserClaims> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const roles = [user.role.name];

    let permissions: string[] = [];
    try {
      const roleId = user.roleId;
      if (roleId) {
        // Assuming role.permissions is now a Json field on Role based on my earlier restoration
        const role = user.role as any;
        if (role.permissions && Array.isArray(role.permissions)) {
          permissions = role.permissions;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Could not load role permissions: ${errorMessage}`);
    }

    return { sub: user.id, email: user.email, roles, permissions };
  }

  async getUserInfo(userId: string): Promise<UserInfo> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const claims = await this.buildUserClaims(userId);

    // Check if premium has expired
    const now = new Date();
    let isPremium = (user.vipTier || 0) > 0;
    let premiumExpired = false;

    if (isPremium && user.vipExpirationDate) {
      if (new Date(user.vipExpirationDate) < now) {
        premiumExpired = true;
        isPremium = false;
      }
    }

    // Reset daily download count if needed (7h sáng UTC+7 = 0h UTC)
    // Reset daily download count (Mocked as the fields were removed from schema)
    let dailyDownloadCount = 0;
    let monthlyDownloadCount = 0;

    if (!isPremium) {
      const resetHourUTC = 0;
      const todayReset = new Date();
      todayReset.setUTCHours(resetHourUTC, 0, 0, 0);

      /* Fields removed from schema - skipping reset logic for now */
    } else {
      /* Fields removed from schema - skipping reset logic for now */
    }

    return {
      sub: claims.sub,
      email: claims.email,
      name: user.displayName,
      avatar_url: user.avatarUrl,
      role: claims.roles?.[0] ?? null,
      status: 'ACTIVE', // status field removed from schema, defaulting to ACTIVE
      roles: claims.roles,
      permissions: claims.permissions,
      is_premium: isPremium,
      premium_expires_at: user.vipExpirationDate,
      premium_expired: premiumExpired,
      current_package_id: null, // field removed
      daily_download_count: dailyDownloadCount,
      monthly_download_count: monthlyDownloadCount,
      daily_download_limit: 3,
      monthly_download_limit: 200,
    };
  }

  async assignDefaultRole(userId: string): Promise<void> {
    try {
      const userRole = await this.prisma.role.findUnique({ where: { slug: 'user' } });
      if (!userRole) {
        this.logger.warn('Default USER role not found - skipping role assignment');
        return;
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { roleId: userRole.id },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to assign default role to user ${userId}: ${errorMessage}`);
    }
  }
}
