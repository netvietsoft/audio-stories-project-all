import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import { User } from '@prisma/client';
import {
  TokenService,
  TokenPair,
  UserClaimsService,
  UserInfo,
  EmailVerificationService,
  PasswordService,
  OAuthService,
  GoogleUserData,
} from './services';
import { UpdateMeDto } from './dto/update-me.dto';
import * as geoip from 'geoip-lite';

export interface RegisterLocalDto {
  email: string;
  password: string;
  name?: string;
  redirect_uri?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    private readonly tokenService: TokenService,
    private readonly userClaimsService: UserClaimsService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordService: PasswordService,
    private readonly oauthService: OAuthService,
  ) { }

  async upsertGoogleUser(google: GoogleUserData, ip?: string): Promise<User> {
    return this.oauthService.upsertGoogleUser(google, ip);
  }

  async buildUserClaims(userId: string) {
    return this.userClaimsService.buildUserClaims(userId);
  }

  async issueTokens(userId: string): Promise<TokenPair> {
    return this.tokenService.issueTokens(userId);
  }

  async rotateRefresh(oldToken: string): Promise<TokenPair> {
    return this.tokenService.rotateRefresh(oldToken);
  }

  async revokeAll(userId: string): Promise<void> {
    return this.tokenService.revokeAll(userId);
  }



  async registerLocal(dto: RegisterLocalDto, ip?: string): Promise<{ ok: boolean; message: string }> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists?.passwordHash) throw new BadRequestException('Email already registered');

    this.logger.log(`Registering user ${dto.email} with IP: ${ip}`);

    let user = exists;
    const isNewUser = !user;

    // Resolve country from IP
    let country: string | null = null;
    if (ip) {
      const geo = geoip.lookup(ip);
      if (geo) {
        country = geo.country;
        this.logger.log(`Resolved country for ${ip}: ${country}`);
      } else {
        this.logger.warn(`GeoIP lookup failed for IP: ${ip}`);
      }
    } else {
      this.logger.warn(`No IP provided for registration`);
    }

    if (!user) {
      const defaultRoleId = await this.ensureDefaultUserRoleId();

      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          displayName: dto.name || '',
          passwordHash: await argon2.hash(dto.password),
          country: country,
          roleId: defaultRoleId,
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(dto.password) },
      });
    }

    if (isNewUser) await this.userClaimsService.assignDefaultRole(user.id);
    await this.emailVerificationService.sendVerificationCode(user.id, user.email, dto.redirect_uri);

    return { ok: true, message: 'Registration successful. Please check your email for verification code.' };
  }

  async loginLocal(email: string, password: string, ip?: string): Promise<TokenPair> {
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerifiedAt) throw new ForbiddenException('Email not verified');

    const data: any = { lastLoginAt: new Date() };

    // Backfill country if missing and IP provided
    if (!user.country && ip) {
      const geo = geoip.lookup(ip);
      if (geo) {
        data.country = geo.country;
      }
    }

    user = await this.prisma.user.update({ where: { id: user.id }, data });
    return this.issueTokens(user.id);
  }

  async verifyEmail(tokenRaw: string, ip?: string): Promise<TokenPair> {
    const userId = await this.emailVerificationService.verifyEmail(tokenRaw);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const data: any = { lastLoginAt: new Date() };
      if (!user.country && ip) {
        const geo = geoip.lookup(ip);
        if (geo) {
          data.country = geo.country;
          this.logger.log(`[VerifyEmail] Backfilled country for ${userId}: ${geo.country} (IP: ${ip})`);
        } else {
          this.logger.warn(`[VerifyEmail] GeoIP lookup failed for IP: ${ip}`);
        }
      }
      await this.prisma.user.update({ where: { id: userId }, data });
    }

    return this.issueTokens(userId);
  }

  async resendVerify(email: string, redirectUri?: string): Promise<{ ok: boolean }> {
    return this.emailVerificationService.resendVerifyEmail(email, redirectUri);
  }

  async verifyCode(email: string, code: string, ip?: string): Promise<TokenPair> {
    const userId = await this.emailVerificationService.verifyCode(email, code);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const data: any = { lastLoginAt: new Date() };
      if (!user.country && ip) {
        const geo = geoip.lookup(ip);
        if (geo) {
          data.country = geo.country;
          this.logger.log(`[VerifyCode] Backfill country: ${geo.country} for IP ${ip}`);
        } else {
          this.logger.warn(`[VerifyCode] GeoIP lookup failed for IP: ${ip}`);
        }
      }
      await this.prisma.user.update({ where: { id: userId }, data });
    }

    return this.issueTokens(userId);
  }

  async resendVerificationCode(email: string): Promise<{ ok: boolean }> {
    return this.emailVerificationService.resendVerificationCode(email);
  }

  async forgotPassword(email: string, redirectUri?: string): Promise<{ ok: boolean }> {
    return this.passwordService.forgotPassword(email, redirectUri);
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ ok: boolean }> {
    return this.passwordService.resetPassword(email, code, newPassword);
  }

  async getUserInfo(userId: string): Promise<UserInfo> {
    return this.userClaimsService.getUserInfo(userId);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<UserInfo> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.name !== undefined ? (dto.name?.trim() || '') : undefined,
        avatarUrl: dto.avatar_url !== undefined ? (dto.avatar_url || null) : undefined,
      },
    });

    return this.userClaimsService.getUserInfo(userId);
  }

  async checkPremiumStatus(userId: string): Promise<{ is_premium: boolean; premium_expires_at: Date | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { vipTier: true, vipExpirationDate: true },
    });

    if (!user) {
      return { is_premium: false, premium_expires_at: null };
    }

    // Check if premium is still valid (not expired)
    const isPremiumValid = (user.vipTier || 0) > 0 &&
      (!user.vipExpirationDate || user.vipExpirationDate > new Date());

    return {
      is_premium: isPremiumValid,
      premium_expires_at: user.vipExpirationDate,
    };
  }

  async searchUsersByEmail(email: string): Promise<{ id: string; email: string; name: string | null; avatar_url: string | null }[]> {
    if (!email || email.length < 3) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: email } },
          { displayName: { contains: email } },
        ],
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
      },
      take: 10,
    });

    console.log('Search query:', email, 'Found:', users.length);
    return users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.displayName,
      avatar_url: u.avatarUrl
    }));
  }

  async findAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        country: true,
        role: {
          select: {
            name: true,
            slug: true
          }
        },
        credits: true,
        vipTier: true,
        vipExpirationDate: true,
        createdAt: true,
        lastLoginAt: true,
        emailVerifiedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
  async getAdminStats() {
    const [totalUsers, totalStories, monthlyPayments, recentUsers, recentReports] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.story.count({ where: { deletedAt: null } }),
      this.prisma.payment.findMany({
        where: {
          status: 'SUCCESS',
          paidAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        select: { amountVnd: true },
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          createdAt: true,
        },
      }),
      this.prisma.audioReport.findMany({
        where: { status: 'pending' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          story: { select: { title: true } },
          chapter: { select: { chapterNumber: true } },
        },
      }),
    ]);

    const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + p.amountVnd, 0);

    // Calculate 24h activity growth
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const prev24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [activeLast24h, activePrev24h] = await Promise.all([
      this.prisma.user.count({
        where: {
          lastLoginAt: { gte: last24h },
          deletedAt: null,
        },
      }),
      this.prisma.user.count({
        where: {
          lastLoginAt: { gte: prev24h, lt: last24h },
          deletedAt: null,
        },
      }),
    ]);

    let growth24h = 0;
    if (activePrev24h > 0) {
      growth24h = Math.round(((activeLast24h - activePrev24h) / activePrev24h) * 100);
    } else if (activeLast24h > 0) {
      growth24h = 100;
    }

    return {
      totalUsers,
      totalStories,
      monthlyRevenue,
      growth24h,
      activeLast24h,
      recentUsers,
      recentReports,
    };
  }

  async findOneUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        userFavorites: {
          include: {
            story: {
              select: {
                id: true,
                title: true,
                slug: true,
                thumbnailUrl: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        listeningHistory: {
          include: {
            story: {
              select: { title: true }
            },
            chapter: {
              select: { title: true, chapterNumber: true }
            }
          },
          orderBy: { lastListenedAt: 'desc' },
          take: 10
        },
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        memberships: {
          include: {
            author: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        oauthAccounts: true
      }
    });

    if (!user) throw new BadRequestException('User not found');
    return user;
  }
}
