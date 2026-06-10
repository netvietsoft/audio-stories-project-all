import {
  collectAllowedOrigins,
  isCorsOriginAllowed,
  parseCommaSeparatedOrigins,
} from './origin.util';

describe('origin.util', () => {
  it('parses comma-separated origins and trims blanks', () => {
    expect(
      parseCommaSeparatedOrigins(
        ' http://localhost:3001,https://admin.example.com ,, ',
      ),
    ).toEqual(['http://localhost:3001', 'https://admin.example.com']);
  });

  it('collects new and legacy origin env names', () => {
    const origins = collectAllowedOrigins({
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.com',
      ADMIN_ORIGIN: 'https://admin.example.com',
      FRONTEND_URL: 'https://legacy.example.com',
      CORS: 'https://cors-a.example.com,https://cors-b.example.com',
      CLIENT_URL: 'https://client.example.com',
      ALLOWED_CLIENT_URLS: 'https://allowed.example.com',
    });

    expect([...origins].sort()).toEqual([
      'https://admin.example.com',
      'https://allowed.example.com',
      'https://client.example.com',
      'https://cors-a.example.com',
      'https://cors-b.example.com',
      'https://legacy.example.com',
      'https://web.example.com',
    ]);
  });

  it('adds local web and admin origins outside production', () => {
    const origins = collectAllowedOrigins({ NODE_ENV: 'development' });
    expect(origins.has('http://localhost:3001')).toBe(true);
    expect(origins.has('http://localhost:3002')).toBe(true);
  });

  it('allows wildcard CORS only outside production', () => {
    expect(
      isCorsOriginAllowed('https://evil.example.com', new Set(['*']), {
        NODE_ENV: 'development',
      }),
    ).toBe(true);
    expect(
      isCorsOriginAllowed('https://evil.example.com', new Set(['*']), {
        NODE_ENV: 'production',
      }),
    ).toBe(false);
  });

  it('rejects unknown production origins', () => {
    const origins = collectAllowedOrigins({
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://web.example.com',
    });
    expect(
      isCorsOriginAllowed('https://web.example.com', origins, {
        NODE_ENV: 'production',
      }),
    ).toBe(true);
    expect(
      isCorsOriginAllowed('https://admin.example.com', origins, {
        NODE_ENV: 'production',
      }),
    ).toBe(false);
  });
});
