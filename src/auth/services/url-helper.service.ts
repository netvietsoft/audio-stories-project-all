import { Injectable, Logger } from '@nestjs/common';
import { isAllowedRedirectUri, getDefaultClientUrl } from '@/common/oauth-client.util';

@Injectable()
export class UrlHelperService {
  private readonly logger = new Logger(UrlHelperService.name);

  getValidatedClientUrl(redirectUri?: string): string {
    const defaultUrl = getDefaultClientUrl();

    if (!redirectUri) return defaultUrl;

    if (isAllowedRedirectUri(redirectUri)) {
      try {
        const url = new URL(redirectUri);
        return url.origin;
      } catch {
        this.logger.warn(`Invalid redirect URI format: ${redirectUri}`);
        return defaultUrl;
      }
    }

    this.logger.warn(`Redirect URI not allowed: ${redirectUri}, using default`);
    return defaultUrl;
  }

  buildVerifyLink(tokenRaw: string, clientUrl?: string): string {
    const base = clientUrl || getDefaultClientUrl();
    return `${base}/auth/verify?token=${encodeURIComponent(tokenRaw)}`;
  }

  buildResetLink(tokenRaw: string, clientUrl?: string): string {
    const base = clientUrl || getDefaultClientUrl();
    return `${base}/auth/reset?token=${encodeURIComponent(tokenRaw)}`;
  }
}
