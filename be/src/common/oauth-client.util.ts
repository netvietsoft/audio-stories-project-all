import { Logger } from '@nestjs/common';
import { collectAllowedOrigins } from './origin.util';

const logger = new Logger('OAuthClientUtil');

export function getAllowedClientUrls(): string[] {
  const configuredOrigins = collectAllowedOrigins({
    ...process.env,
    NODE_ENV: 'production',
  });

  if (configuredOrigins.size === 0) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';
    return [clientUrl];
  }

  const validUrls: string[] = [];
  for (const url of configuredOrigins) {
    if (url === '*') continue;
    try {
      const parsed = new URL(url);
      validUrls.push(parsed.origin);
    } catch {
      logger.error(`Invalid URL in client origin configuration: ${url}`);
    }
  }

  return validUrls.length > 0
    ? Array.from(new Set(validUrls))
    : ['http://localhost:3001'];
}

export function isAllowedRedirectUri(redirectUri: string): boolean {
  if (!redirectUri) return false;

  // Allow internal paths
  if (redirectUri.startsWith('/')) return true;

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

export function getDefaultRedirectUri(
  callbackPath = '/auth/google/callback',
): string {
  return `${getDefaultClientUrl()}${callbackPath}`;
}

export function buildOAuthState(
  redirectUri: string,
  additionalData?: Record<string, unknown>,
): string {
  const stateData = {
    redirect_uri: redirectUri,
    ...additionalData,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(stateData)).toString('base64');
}

export function parseOAuthState(
  state: string,
): {
  redirect_uri?: string;
  timestamp?: number;
  [key: string]: unknown;
} | null {
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
