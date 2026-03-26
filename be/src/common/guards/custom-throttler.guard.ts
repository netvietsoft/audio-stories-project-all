import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(context: ExecutionContext): Promise<string> {
    const req = context.switchToHttp().getRequest() as any;
    // Prefer first IP from ips (when behind proxy), fallback to req.ip
    const ip = Array.isArray(req?.ips) && req.ips.length ? req.ips[0] : req?.ip;
    return ip || (req?.headers?.['x-forwarded-for'] || '').split(',')[0] || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Bypass throttling when not in production
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    // Otherwise use default throttler logic
    return super.canActivate(context);
  }
}
