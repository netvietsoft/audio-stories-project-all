import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  Post,
  Patch,
  HttpCode,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { Account } from './decorators/account.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyCodeDto, ResendCodeDto, ResendVerifyDto } from './dto/verify-code.dto';
import { ForgotDto } from './dto/forgot.dto';
import { ResetDto } from './dto/reset.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { CheckPremiumDto } from './dto/check-premium.dto';
import { GoogleUser, JwtPayload } from './types';
import {
  parseOAuthState,
  isAllowedRedirectUri,
  getDefaultRedirectUri,
  getDefaultClientUrl,
} from '@/common/oauth-client.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() { }

  @Get('google-redirect')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response, @Query('state') state?: string) {
    try {
      if (!req.user) return res.status(401).json({ statusCode: 401, message: 'Authentication failed' });

      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const clientIp = ip ? ip.split(',')[0].trim() : undefined;

      const user = await this.auth.upsertGoogleUser(req.user as GoogleUser, clientIp);
      const { access, refresh } = await this.auth.issueTokens(user.id);

      let redirectUri: string | undefined;
      if (state) {
        const stateData = parseOAuthState(state);
        if (stateData?.redirect_uri && isAllowedRedirectUri(stateData.redirect_uri)) {
          redirectUri = stateData.redirect_uri;
        }
      }
      if (!redirectUri) redirectUri = getDefaultRedirectUri();

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('access_token', access);
      redirectUrl.searchParams.set('refresh_token', refresh);
      redirectUrl.searchParams.set('verified', 'true');
      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('[Google OAuth] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      const errorRedirectUri = getDefaultRedirectUri().replace('/api/auth/google-redirect', '/auth-error');
      return res.redirect(`${errorRedirectUri}?error=${encodeURIComponent(errorMessage)}`);
    }
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  async me(@Account() user: any) {
    return await this.auth.getUserInfo(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async updateMe(@Account() user: any, @Body() dto: UpdateMeDto) {
    return await this.auth.updateMe(user.id, dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  async refresh(@Req() req: Request) {
    const oldToken = (req.cookies?.refresh_token as string) || (req.headers['x-refresh-token'] as string);
    const { access, refresh: newRefresh } = await this.auth.rotateRefresh(oldToken);
    return { ok: true, access_token: access, refresh_token: newRefresh };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAccessGuard)
  async logout(@Account() user: JwtPayload) {
    await this.auth.revokeAll(user.sub);
    return { ok: true };
  }

  @Post('register')
  @HttpCode(200)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    // Get IP address
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    // Handle multiple IPs in x-forwarded-for (e.g. "client, proxy1, proxy2")
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    return this.auth.registerLocal({ email: dto.email, password: dto.password, name: dto.name, redirect_uri: dto.redirect_uri }, clientIp);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    // Get IP address
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const { access, refresh } = await this.auth.loginLocal(dto.email, dto.password, clientIp);
    return { ok: true, access_token: access, refresh_token: refresh };
  }

  @Get('verify-email')
  async verifyEmailGet(@Query('token') token: string, @Query('redirect_uri') redirectUri: string | undefined, @Res() res: Response, @Req() req: Request) {
    // Get IP address
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const { access, refresh } = await this.auth.verifyEmail(token, clientIp);
    let finalRedirectUrl = redirectUri && isAllowedRedirectUri(redirectUri) ? redirectUri : getDefaultClientUrl();
    const redirectUrl = new URL(finalRedirectUrl);
    redirectUrl.searchParams.set('access_token', access);
    redirectUrl.searchParams.set('refresh_token', refresh);
    redirectUrl.searchParams.set('verified', 'true');
    return res.redirect(redirectUrl.toString());
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmailPost(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    // Get IP address
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const { access, refresh } = await this.auth.verifyEmail(dto.token, clientIp);
    return { ok: true, access_token: access, refresh_token: refresh };
  }

  @Post('resend-verify')
  @HttpCode(200)
  async resend(@Body() dto: ResendVerifyDto) {
    return this.auth.resendVerify(dto.email, dto.redirect_uri);
  }

  @Post('verify-code')
  @HttpCode(200)
  async verifyCode(@Body() dto: VerifyCodeDto, @Req() req: Request) {
    // Get IP address
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const { access, refresh } = await this.auth.verifyCode(dto.email, dto.code, clientIp);
    return { ok: true, message: 'Email verified successfully', access_token: access, refresh_token: refresh };
  }

  @Post('resend-code')
  @HttpCode(200)
  async resendCode(@Body() dto: ResendCodeDto) {
    return this.auth.resendVerificationCode(dto.email);
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgot(@Body() dto: ForgotDto) {
    return this.auth.forgotPassword(dto.email, dto.redirect_uri);
  }

  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Post('check-premium')
  @HttpCode(200)
  async checkPremium(@Body() dto: CheckPremiumDto) {
    return this.auth.checkPremiumStatus(dto.user_id);
  }

  @Get('search-users')
  @UseGuards(JwtAccessGuard)
  async searchUsers(@Query('email') email: string) {
    return this.auth.searchUsersByEmail(email);
  }

  @Get('users')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  async findAllUsers() {
    return this.auth.findAllUsers();
  }

  @Get('admin/stats')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  async getAdminStats() {
    return this.auth.getAdminStats();
  }

  @Get('users/:id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  async findOneUser(@Param('id') id: string) {
    return this.auth.findOneUser(id);
  }
}
