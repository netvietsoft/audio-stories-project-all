import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface UserClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface UserInfo {
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  status: string;
  roles: string[];
  permissions: string[];
  // Premium & download fields (for FE compatibility)
  credits: number;
  vip_tier: number;
  premium_expires_at: Date | null;
  allow_email_noti: boolean;
  allow_bell_noti: boolean;
}

@Injectable()
export class UserClaimsService {
  private readonly logger = new Logger(UserClaimsService.name);

  constructor(private readonly prisma: PrismaService) { }

  async buildUserClaims(userId: string): Promise<UserClaims> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        roleId: true,
        role: {
          select: {
            name: true,
            permissions: true,
          },
        },
      },
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        credits: true,
        vipTier: true,
        vipExpirationDate: true,
        allowEmailNoti: true,
        allowBellNoti: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const claims = await this.buildUserClaims(userId);

    return {
      email: claims.email,
      name: user.displayName,
      avatar_url: user.avatarUrl,
      role: claims.roles?.[0] ?? null,
      status: 'ACTIVE', // status field removed from schema, defaulting to ACTIVE
      roles: claims.roles,
      permissions: claims.permissions,
      credits: user.credits,
      vip_tier: user.vipTier,
      premium_expires_at: user.vipExpirationDate,
      allow_email_noti: user.allowEmailNoti,
      allow_bell_noti: user.allowBellNoti,
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
