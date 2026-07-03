import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isAllowedRedirectUri, buildOAuthState, getDefaultRedirectUri } from '@/common/oauth-client.util';
import { Request, Response } from 'express';
import passport from 'passport';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleOAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const redirectUri = request.query?.redirect_uri as string | undefined;

    let finalRedirectUri: string;

    if (redirectUri) {
      if (!isAllowedRedirectUri(redirectUri)) {
        this.logger.warn(`Rejected invalid redirect_uri: ${redirectUri}`);
        finalRedirectUri = getDefaultRedirectUri();
      } else {
        finalRedirectUri = redirectUri;
      }
    } else {
      finalRedirectUri = getDefaultRedirectUri();
    }

    const state = buildOAuthState(finalRedirectUri);

    return new Promise((resolve, reject) => {
      const authenticateOptions = {
        scope: ['email', 'profile'],
        session: false,
        state: state,
      };

      passport.authenticate('google', authenticateOptions, (err: Error | null, user: unknown) => {
        if (err) {
          this.logger.error(`Authentication error: ${err.message}`);
          reject(new UnauthorizedException(err.message));
          return;
        }

        if (!user) {
          resolve(true);
          return;
        }

        request.user = user;
        resolve(true);
      })(request, response, (err: Error | null) => {
        if (err) reject(err);
      });
    });
  }
}
