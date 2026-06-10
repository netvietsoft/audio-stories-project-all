import type { CookieOptions } from 'express';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

function parseSameSite(value: string | undefined): CookieOptions['sameSite'] {
  if (value === 'strict' || value === 'lax' || value === 'none') return value;
  return 'lax';
}

export function getRefreshCookieOptions(
  env: NodeJS.ProcessEnv = process.env,
): CookieOptions {
  const secure = parseBoolean(env.COOKIE_SECURE, env.NODE_ENV === 'production');
  const domain = env.COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true,
    secure,
    sameSite: parseSameSite(env.COOKIE_SAME_SITE),
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    ...(domain ? { domain } : {}),
  };
}

export function getRefreshCookieClearOptions(
  env: NodeJS.ProcessEnv = process.env,
): CookieOptions {
  const { maxAge, ...options } = getRefreshCookieOptions(env);
  return options;
}
