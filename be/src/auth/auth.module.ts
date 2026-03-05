import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

import {
  TokenService,
  UserClaimsService,
  EmailVerificationService,
  PasswordService,
  OAuthService,
  UrlHelperService,
} from './services';

import { MailModule } from '@/mail/mail.module';

@Module({
  imports: [
    PassportModule.register({}),
    JwtModule.register({}),
    MailModule,
  ],
  providers: [
    AuthService,
    TokenService,
    UserClaimsService,
    EmailVerificationService,
    PasswordService,
    OAuthService,
    UrlHelperService,
    GoogleStrategy,
    JwtAccessStrategy,
    JwtRefreshStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, TokenService, UserClaimsService],
})
export class AuthModule {}
