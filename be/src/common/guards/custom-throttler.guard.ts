import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  protected async getTracker(context: ExecutionContext): Promise<string> {
    try {
      const req = context.switchToHttp().getRequest() as any;
      // Prefer first IP from ips (when behind proxy), fallback to req.ip
      const ip = Array.isArray(req?.ips) && req.ips.length ? req.ips[0] : req?.ip;
      return ip || (req?.headers?.['x-forwarded-for'] || '').split(',')[0] || 'unknown';
    } catch {
      return 'non-http-context';
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow explicit opt-out via env var (useful in dev/staging/CI).
    // Do NOT set this in production.
    if (process.env.THROTTLE_DISABLED === 'true') {
      return true;
    }

    try {
      return await super.canActivate(context);
    } catch (error) {
      // Fail-closed: if throttler storage is unavailable, deny rather than allow.
      // This prevents an outage of Redis/storage from silently disabling rate-limiting.
      this.logger.error('Throttler error — failing closed (denying request)', error);
      throw new ThrottlerException();
    }
  }
}

