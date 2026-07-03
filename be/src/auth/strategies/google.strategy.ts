import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || 'placeholder';
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || 'placeholder';
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:8000/auth/google-redirect';

    if (clientID === 'placeholder') {
      console.warn('[GoogleStrategy] GOOGLE_CLIENT_ID not configured - Google OAuth disabled');
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });
  }

  validate(accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback): void {
    try {
      const email = profile.emails?.[0]?.value;

      if (!email) {
        this.logger.error('No email found in Google profile');
        return done(new UnauthorizedException('Google account must have an email'), undefined);
      }

      const user = {
        provider: 'google' as const,
        provider_user_id: profile.id,
        email,
        name: profile.displayName || profile.name?.givenName || '',
        avatar_url: profile.photos?.[0]?.value || null,
        raw: profile._json,
      };

      return done(null, user);
    } catch (error) {
      this.logger.error('Error validating profile:', error);
      return done(error as Error, undefined);
    }
  }
}
