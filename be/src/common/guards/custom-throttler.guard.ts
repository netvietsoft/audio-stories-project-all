import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(context: ExecutionContext): Promise<string> {
    try {
      // Try to get HTTP request
      const req = context.switchToHttp().getRequest() as any;
      // Prefer first IP from ips (when behind proxy), fallback to req.ip
      const ip = Array.isArray(req?.ips) && req.ips.length ? req.ips[0] : req?.ip;
      return ip || (req?.headers?.['x-forwarded-for'] || '').split(',')[0] || '';
    } catch (error) {
      // If switchToHttp fails, return a fallback tracker
      return 'non-http-context';
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Bypass throttling when not in production
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    try {
      // Otherwise use default throttler logic
      return super.canActivate(context);
    } catch (error) {
      // If throttler fails, allow the request
      return true;
    }
  }
}
