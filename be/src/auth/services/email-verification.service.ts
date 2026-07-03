import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { UrlHelperService } from './url-helper.service';

import { AuthTokenType } from '@prisma/client';

type EmailTokenType = AuthTokenType;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly urlHelper: UrlHelperService,
  ) { }

  async verifyEmail(tokenRaw: string): Promise<string> {
    const token = await this.findValidEmailToken('VERIFY_EMAIL', tokenRaw);
    await this.prisma.authToken.update({ where: { id: token.id }, data: { isUsed: true } });
    await this.prisma.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } });
    return token.userId;
  }

  async verifyCode(email: string, code: string): Promise<string> {
    const token = await this.findValidVerificationCode(email, code);
    await this.prisma.authToken.update({ where: { id: token.id }, data: { isUsed: true } });
    await this.prisma.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } });
    return token.userId;
  }

  async resendVerifyEmail(email: string, redirectUri?: string): Promise<{ ok: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };
    if (user.emailVerifiedAt) return { ok: true };

    const tokenRaw = this.generateTokenRaw();
    await this.saveEmailToken(user.id, 'VERIFY_EMAIL', tokenRaw, 1000 * 60 * 60 * 24);

    const clientUrl = this.urlHelper.getValidatedClientUrl(redirectUri);
    const link = this.urlHelper.buildVerifyLink(tokenRaw, clientUrl);

    if (process.env.SMTP_HOST) {
      await this.mail.sendVerifyEmail(user.email, link);
    } else {
      this.logger.warn(`SMTP not configured. Verify link: ${link}`);
    }

    return { ok: true };
  }

  async resendVerificationCode(email: string): Promise<{ ok: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };
    if (user.emailVerifiedAt) throw new BadRequestException('Email already verified');

    const code = this.generateVerificationCode();
    await this.saveVerificationCode(user.id, code, 1000 * 60 * 10);

    if (process.env.SMTP_HOST) {
      await this.mail.sendVerificationCode(user.email, code);
    } else {
      this.logger.warn(`SMTP not configured. Verification code: ${code}`);
    }

    return { ok: true };
  }

  async sendVerificationCode(userId: string, email: string, redirectUri?: string): Promise<void> {
    const clientUrl = this.urlHelper.getValidatedClientUrl(redirectUri);
    const code = this.generateVerificationCode();
    await this.saveVerificationCode(userId, code, 1000 * 60 * 10);

    if (process.env.SMTP_HOST) {
      await this.mail.sendVerificationCode(email, code);
    } else {
      this.logger.warn(`SMTP not configured. Verification code: ${code}`);
      this.logger.log(`Client URL for redirect: ${clientUrl}`);
      await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
      this.logger.log('Auto-verified for development');
    }
  }

  generateTokenRaw(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  generateVerificationCode(): string {
    // Crypto-secure 6-digit code (100000–999999). Math.random() is predictable.
    return crypto.randomInt(100000, 1000000).toString();
  }

  async saveEmailToken(userId: string, type: EmailTokenType, tokenRaw: string, ttlMs: number): Promise<void> {
    const token = await argon2.hash(tokenRaw);
    await this.prisma.authToken.create({
      data: { userId, type, token, expiresAt: new Date(Date.now() + ttlMs) },
    });
  }

  async saveVerificationCode(userId: string, code: string, ttlMs: number): Promise<void> {
    const token = await argon2.hash(code);
    await this.prisma.authToken.deleteMany({ where: { userId, type: 'VERIFY_CODE' } });
    await this.prisma.authToken.create({
      data: { userId, type: 'VERIFY_CODE', token, expiresAt: new Date(Date.now() + ttlMs) },
    });
  }

  private async findValidEmailToken(type: EmailTokenType, tokenRaw: string) {
    const tokens = await this.prisma.authToken.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
    });

    for (const t of tokens) {
      if (t.isUsed) continue;
      if (t.expiresAt.getTime() < Date.now()) continue;
      if (await argon2.verify(t.token, tokenRaw)) return t;
    }
    throw new UnauthorizedException('Invalid or expired token');
  }

  private async findValidVerificationCode(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid email or code');

    const tokens = await this.prisma.authToken.findMany({
      where: { userId: user.id, type: 'VERIFY_CODE' },
      orderBy: { createdAt: 'desc' },
    });

    for (const t of tokens) {
      if (t.isUsed) continue;
      if (t.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Verification code has expired');
      if (await argon2.verify(t.token, code)) return t;
    }
    throw new UnauthorizedException('Invalid verification code');
  }
}
