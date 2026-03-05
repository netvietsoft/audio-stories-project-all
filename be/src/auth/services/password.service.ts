import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { EmailVerificationService } from './email-verification.service';
import { UrlHelperService } from './url-helper.service';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly emailVerification: EmailVerificationService,
    private readonly urlHelper: UrlHelperService,
  ) { }

  async forgotPassword(email: string, redirectUri?: string): Promise<{ ok: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };

    const tokenRaw = this.emailVerification.generateTokenRaw();
    await this.emailVerification.saveEmailToken(user.id, 'PASSWORD_RESET', tokenRaw, 1000 * 60 * 30);

    const clientUrl = this.urlHelper.getValidatedClientUrl(redirectUri);
    const link = this.urlHelper.buildResetLink(tokenRaw, clientUrl);

    if (process.env.SMTP_HOST) {
      await this.mail.sendResetPassword(email, link);
    } else {
      this.logger.warn(`SMTP not configured. Reset link: ${link}`);
    }

    return { ok: true };
  }

  async resetPassword(tokenRaw: string, newPassword: string): Promise<{ ok: boolean }> {
    const token = await this.findValidResetToken(tokenRaw);
    await this.prisma.authToken.update({ where: { id: token.id }, data: { isUsed: true } });

    const hash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash: hash } });

    return { ok: true };
  }

  private async findValidResetToken(tokenRaw: string) {
    const tokens = await this.prisma.authToken.findMany({
      where: { type: 'PASSWORD_RESET' },
      orderBy: { createdAt: 'desc' },
    });

    for (const t of tokens) {
      if (t.isUsed) continue;
      if (t.expiresAt.getTime() < Date.now()) continue;
      if (await argon2.verify(t.token, tokenRaw)) return t;
    }
    throw new UnauthorizedException('Invalid or expired token');
  }
}
