import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

@Module({
  imports: [ConfigModule],
  providers: [
    MailService,
    {
      provide: 'MAIL_TRANSPORT',
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        nodemailer.createTransport({
          host: cfg.get<string>('SMTP_HOST'),
          port: Number(cfg.get<string>('SMTP_PORT') || 587),
          secure: cfg.get('SMTP_SECURE') === 'true',
          auth: {
            user: cfg.get<string>('SMTP_USER'),
            pass: cfg.get<string>('SMTP_PASS'),
          },
        }),
    },
  ],
  exports: [MailService],
})
export class MailModule {}
