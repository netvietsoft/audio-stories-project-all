import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtAccessStrategy.name);

  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          const fromCookie = req?.cookies?.access_token;
          if (fromCookie) return fromCookie;

          const cookieHeader = req?.headers?.cookie;
          if (cookieHeader) {
            const match = cookieHeader.match(/access_token=([^;]+)/);
            if (match) {
              const token = decodeURIComponent(match[1]);
              if (token) return token;
            }
          }

          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: any) {
    try {
      if (!payload || !payload.sub) return null;

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return null;

      return { ...user, sub: payload.sub, roles: payload.roles, permissions: payload.permissions };
    } catch (error) {
      this.logger.error('Error during JWT validation:', error);
      return null;
    }
  }
}
