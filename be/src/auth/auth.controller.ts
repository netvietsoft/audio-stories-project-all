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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { SetUserPulseDto } from './dto/set-user-credits.dto';
import { SetUserActiveDto } from './dto/set-user-active.dto';
import { GoogleUser, JwtPayload } from './types';
import {
  parseOAuthState,
  isAllowedRedirectUri,
  getDefaultRedirectUri,
  getDefaultClientUrl,
} from '@/common/oauth-client.util';
import { getRefreshCookieClearOptions, getRefreshCookieOptions } from './refresh-cookie.options';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  @ApiOperation({ summary: 'Bắt đầu đăng nhập Google OAuth' })
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() { }

  @ApiOperation({ summary: 'Xử lý callback Google OAuth, cấp token' })
  @Get('google-redirect')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response, @Query('state') state?: string) {
    try {
      if (!req.user) return res.status(401).json({ statusCode: 401, message: 'Authentication failed' });

      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const clientIp = ip ? ip.split(',')[0].trim() : undefined;

      const user = await this.auth.upsertGoogleUser(req.user as GoogleUser, clientIp);
      const { access, refresh } = await this.auth.issueTokens(user.id);

      // We ALWAYS want to go back to the default callback page on the frontend (e.g. /auth/google/callback)
      // because that page is responsible for handling access_token and redirect state.
      const redirectUri = getDefaultRedirectUri();
      let returnTo: string | undefined;

      if (state) {
        const stateData = parseOAuthState(state);
        // We capture the target destination from the state
        if (stateData?.redirect_uri) {
          returnTo = stateData.redirect_uri;
        }
      }

      const redirectUrl = new URL(redirectUri);
      this.setRefreshCookie(res, refresh);
      redirectUrl.searchParams.set('access_token', access);
      redirectUrl.searchParams.set('verified', 'true');
      
      // If we have a returnTo target, pass it as 'redirect'
      if (returnTo) {
        redirectUrl.searchParams.set('redirect', returnTo);
      }
      
      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('[Google OAuth] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      const errorRedirectUri = getDefaultRedirectUri().replace('/api/auth/google-redirect', '/auth-error');
      return res.redirect(`${errorRedirectUri}?error=${encodeURIComponent(errorMessage)}`);
    }
  }

  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  @Get('me')
  @UseGuards(JwtAccessGuard)
  async me(@Account() user: any) {
    const userInfo = await this.auth.getUserInfo(user.id);
    // L4: chỉ trả _debug (jwtPayload) ngoài production để tránh lộ roles/permissions.
    if (process.env.NODE_ENV === 'production') {
      return userInfo;
    }
    return {
      ...userInfo,
      _debug: {
        jwtPayload: {
          sub: user.sub,
          roles: user.roles,
          permissions: user.permissions,
        },
      },
    };
  }

  @ApiOperation({ summary: 'Cập nhật thông tin người dùng hiện tại' })
  @Patch('me')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async updateMe(@Account() user: any, @Body() dto: UpdateMeDto) {
    return await this.auth.updateMe(user.id, dto);
  }

  /** Set refresh token in a Secure HttpOnly cookie (not visible to JS). */
  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, getRefreshCookieOptions());
  }

  @ApiOperation({ summary: 'Làm mới access token bằng refresh token' })
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Read from HttpOnly cookie first, fall back to header for backwards compat
    const oldToken = (req.cookies?.refresh_token as string) || (req.headers['x-refresh-token'] as string);
    const { access, refresh: newRefresh } = await this.auth.rotateRefresh(oldToken);
    // Set new refresh token in HttpOnly cookie — do NOT expose in body
    this.setRefreshCookie(res, newRefresh);
    return { ok: true, access_token: access };
  }

  @ApiOperation({ summary: 'Đăng xuất, thu hồi token và xóa cookie' })
  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAccessGuard)
  async logout(@Account() user: JwtPayload, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeAll(user.sub);
    // Clear refresh token cookie
    res.clearCookie('refresh_token', getRefreshCookieClearOptions());
    return { ok: true };
  }

  @ApiOperation({ summary: 'Đăng ký tài khoản bằng email' })
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('register')
  @HttpCode(200)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    // Get IP address
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    // Handle multiple IPs in x-forwarded-for (e.g. "client, proxy1, proxy2")
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    return this.auth.registerLocal({ email: dto.email, password: dto.password, name: dto.name, redirect_uri: dto.redirect_uri }, clientIp);
  }

  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu' })
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const { access, refresh } = await this.auth.loginLocal(dto.email, dto.password, clientIp);
    // Set refresh token in HttpOnly cookie — not exposed to JS
    this.setRefreshCookie(res, refresh);
    return { ok: true, access_token: access };
  }

  @ApiOperation({ summary: 'Xác thực email qua link token, chuyển hướng' })
  @Get('verify-email')
  async verifyEmailGet(@Query('token') token: string, @Query('redirect_uri') redirectUri: string | undefined, @Res() res: Response, @Req() req: Request) {
    // Get IP address
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const { access, refresh } = await this.auth.verifyEmail(token, clientIp);
    let finalRedirectUrl = redirectUri && isAllowedRedirectUri(redirectUri) ? redirectUri : getDefaultClientUrl();
    const redirectUrl = new URL(finalRedirectUrl);
    this.setRefreshCookie(res, refresh);
    redirectUrl.searchParams.set('access_token', access);
    redirectUrl.searchParams.set('verified', 'true');
    return res.redirect(redirectUrl.toString());
  }

  @ApiOperation({ summary: 'Xác thực email bằng token' })
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmailPost(@Body() dto: VerifyEmailDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const { access, refresh } = await this.auth.verifyEmail(dto.token, clientIp);
    this.setRefreshCookie(res, refresh);
    return { ok: true, access_token: access };
  }

  @ApiOperation({ summary: 'Gửi lại email xác thực' })
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('resend-verify')
  @HttpCode(200)
  async resend(@Body() dto: ResendVerifyDto) {
    return this.auth.resendVerify(dto.email, dto.redirect_uri);
  }

  @ApiOperation({ summary: 'Xác thực email bằng mã code' })
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('verify-code')
  @HttpCode(200)
  async verifyCode(@Body() dto: VerifyCodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const clientIp = ip ? ip.split(',')[0].trim() : undefined;

    const { access, refresh } = await this.auth.verifyCode(dto.email, dto.code, clientIp);
    this.setRefreshCookie(res, refresh);
    return { ok: true, message: 'Email verified successfully', access_token: access };
  }

  @ApiOperation({ summary: 'Gửi lại mã xác thực email' })
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('resend-code')
  @HttpCode(200)
  async resendCode(@Body() dto: ResendCodeDto) {
    return this.auth.resendVerificationCode(dto.email);
  }

  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu qua email' })
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgot(@Body() dto: ForgotDto) {
    return this.auth.forgotPassword(dto.email, dto.redirect_uri);
  }

  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng mã xác thực' })
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetDto) {
    return this.auth.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @ApiOperation({ summary: 'Đổi mật khẩu khi đã đăng nhập' })
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('change-password')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async changePassword(@Account() user: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  @ApiOperation({ summary: 'Kiểm tra trạng thái premium của người dùng' })
  @Post('check-premium')
  @UseGuards(JwtAccessGuard)
  @HttpCode(200)
  async checkPremium(@Account() user: any) {
    // Security: premium status is always for the authenticated user — never an
    // arbitrary user_id from the request body.
    return this.auth.checkPremiumStatus(user.id);
  }

  @ApiOperation({ summary: 'Tìm kiếm người dùng theo email' })
  @Get('search-users')
  @UseGuards(JwtAccessGuard)
  async searchUsers(@Query('email') email: string) {
    return this.auth.searchUsersByEmail(email);
  }

  @ApiOperation({ summary: 'Lấy danh sách tất cả người dùng (admin)' })
  @Get('users')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  async findAllUsers() {
    return this.auth.findAllUsers();
  }

  @ApiOperation({ summary: 'Lấy thống kê quản trị (admin)' })
  @Get('admin/stats')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  async getAdminStats() {
    return this.auth.getAdminStats();
  }

  @ApiOperation({ summary: 'Lấy chi tiết một người dùng theo id (admin)' })
  @Get('users/:id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  async findOneUser(@Param('id') id: string) {
    return this.auth.findOneUser(id);
  }

  @ApiOperation({ summary: 'Cập nhật số dư pulse của người dùng (admin)' })
  @Patch('users/:id/pulse')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  async setUserPulse(@Param('id') id: string, @Body() dto: SetUserPulseDto) {
    return this.auth.setUserPulse(id, dto.pulseBalance);
  }

  @ApiOperation({ summary: 'Khoá/mở khoá tài khoản người dùng (admin)' })
  @Patch('users/:id/active')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  async setUserActive(@Param('id') id: string, @Body() dto: SetUserActiveDto) {
    return this.auth.setUserActive(id, dto.isActive);
  }
}
