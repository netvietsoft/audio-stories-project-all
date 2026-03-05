import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  private readonly logger = new Logger(JwtRefreshStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => {
          const token = req?.headers?.['x-refresh-token'];
          return token || null;
        },
        (req) => {
          const token = req?.cookies?.refresh_token;
          return token || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET!,
      passReqToCallback: true, // Allow accessing req in validate
    });
  }

  validate(req: any, payload: any) {
    return payload;
  }
}
