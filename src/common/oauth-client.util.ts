import { Logger } from '@nestjs/common';

const logger = new Logger('OAuthClientUtil');

export function getAllowedClientUrls(): string[] {
  const envValue = process.env.ALLOWED_CLIENT_URLS || '';

  if (!envValue.trim()) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    return [clientUrl];
  }

  const urls = envValue
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  const validUrls: string[] = [];
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      validUrls.push(parsed.origin);
    } catch {
      logger.error(`Invalid URL in ALLOWED_CLIENT_URLS: ${url}`);
    }
  }

  return validUrls.length > 0 ? validUrls : ['http://localhost:3000'];
}

export function isAllowedRedirectUri(redirectUri: string): boolean {
  if (!redirectUri) return false;

  try {
    const parsed = new URL(redirectUri);
    const origin = parsed.origin;
    const allowedUrls = getAllowedClientUrls();
    return allowedUrls.some((allowedUrl) => origin === allowedUrl);
  } catch {
    return false;
  }
}

export function getDefaultClientUrl(): string {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL;
  const allowedUrls = getAllowedClientUrls();
  return allowedUrls.length > 0 ? allowedUrls[0] : 'http://localhost:3000';
}

export function getDefaultRedirectUri(callbackPath = '/auth/google/callback'): string {
  return `${getDefaultClientUrl()}${callbackPath}`;
}

export function buildOAuthState(redirectUri: string, additionalData?: Record<string, unknown>): string {
  const stateData = {
    redirect_uri: redirectUri,
    ...additionalData,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(stateData)).toString('base64');
}

export function parseOAuthState(state: string): { redirect_uri?: string; timestamp?: number;[key: string]: unknown } | null {
  if (!state) return null;

  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    if (parsed.timestamp) {
      const age = Date.now() - parsed.timestamp;
      const maxAge = 10 * 60 * 1000;
      if (age > maxAge) return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
