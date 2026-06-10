export function parseCommaSeparatedOrigins(
  value: string | undefined,
): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function collectAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const origins = new Set<string>();

  for (const key of [
    'WEB_ORIGIN',
    'ADMIN_ORIGIN',
    'FRONTEND_URL',
    'CLIENT_URL',
  ]) {
    const value = env[key];
    if (value?.trim()) origins.add(value.trim());
  }

  for (const key of ['CORS', 'ALLOWED_CLIENT_URLS']) {
    for (const origin of parseCommaSeparatedOrigins(env[key])) {
      origins.add(origin);
    }
  }

  if (env.NODE_ENV !== 'production') {
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://localhost:3058',
      'http://127.0.0.1:3058',
    ].forEach((origin) => origins.add(origin));
  }

  return origins;
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: Set<string>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (allowedOrigins.has('*') && env.NODE_ENV !== 'production') return true;
  if (allowedOrigins.size === 0 && env.NODE_ENV !== 'production') return true;

  return false;
}
