import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { EmailVerificationService } from './email-verification.service';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly emailVerification: EmailVerificationService,
  ) { }

  async forgotPassword(email: string, redirectUri?: string): Promise<{ ok: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };

    const code = this.emailVerification.generateVerificationCode();
    await this.saveResetCode(user.id, code, 1000 * 60 * 10);

    if (process.env.SMTP_HOST) {
      await this.mail.sendResetPasswordCode(email, code);
    } else {
      this.logger.warn(`SMTP not configured. Reset code for ${email}: ${code}`);
    }

    return { ok: true };
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ ok: boolean }> {
    const token = await this.findValidResetCode(email, code);
    await this.prisma.authToken.update({ where: { id: token.id }, data: { isUsed: true } });

    const hash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash: hash } });

    return { ok: true };
  }

  private async saveResetCode(userId: string, code: string, ttlMs: number): Promise<void> {
    const token = await argon2.hash(code);
    await this.prisma.authToken.deleteMany({ where: { userId, type: 'PASSWORD_RESET' } });
    await this.prisma.authToken.create({
      data: { userId, type: 'PASSWORD_RESET', token, expiresAt: new Date(Date.now() + ttlMs) },
    });
  }

  private async findValidResetCode(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid email or reset code');

    const tokens = await this.prisma.authToken.findMany({
      where: { userId: user.id, type: 'PASSWORD_RESET' },
      orderBy: { createdAt: 'desc' },
    });

    for (const t of tokens) {
      if (t.isUsed) continue;
      if (t.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Reset code has expired');
      if (await argon2.verify(t.token, code)) return t;
    }
    throw new UnauthorizedException('Invalid reset code');
  }
}
