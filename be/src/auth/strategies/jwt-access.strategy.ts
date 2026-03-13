import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtAccessStrategy.name);
  private dbUnavailableLogged = false;

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

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });
      if (!user) return null;

      // Ensure roles is always an array for RolesGuard
      const roles = user.role ? [user.role.name] : [];

      return { ...user, sub: payload.sub, roles, permissions: payload.permissions };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P1001') {
        // Avoid flooding logs when DB is temporarily unreachable.
        if (!this.dbUnavailableLogged) {
          this.logger.error('Database unreachable during JWT validation (P1001). Returning unauthorized.');
          this.dbUnavailableLogged = true;
        }
        return null;
      }

      this.logger.error('Error during JWT validation:', error);
      return null;
    }
  }
}
