import { parseAppConfig } from '../app-config.schema';

const validEnv = (overrides: Record<string, string | undefined> = {}) => ({
  APP_ROLE: 'api',
  NODE_ENV: 'development',
  HOST: '0.0.0.0',
  PORT: '3000',
  DATABASE_URL: 'mysql://user:pass@host:3306/db',
  REDIS_URL: 'redis://localhost:6379/0',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_TTL: '7d',
  JWT_REFRESH_TTL: '30d',
  WEB_ORIGIN: 'http://localhost:3001',
  ADMIN_ORIGIN: 'http://localhost:3002',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'no-reply@example.com',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'admin123',
  INTERNAL_API_KEY: 'k'.repeat(16),
  HLS_MASTER_KEY: 'a'.repeat(64),
  PUBLIC_API_URL: 'http://localhost:3000',
  ...overrides,
});

describe('parseAppConfig', () => {
  it('parses a valid env', () => {
    const cfg = parseAppConfig(validEnv());
    expect(cfg.runtime.appRole).toBe('api');
    expect(cfg.runtime.port).toBe(3000);
    expect(cfg.database.url).toBe('mysql://user:pass@host:3306/db');
    expect(cfg.auth.jwtAccessSecret).toBe('a'.repeat(32));
  });

  it('coerces PORT to number', () => {
    const cfg = parseAppConfig(validEnv({ PORT: '4000' }));
    expect(typeof cfg.runtime.port).toBe('number');
    expect(cfg.runtime.port).toBe(4000);
  });

  it('throws when required env missing', () => {
    expect(() => parseAppConfig(validEnv({ DATABASE_URL: undefined }))).toThrow(/DATABASE_URL/);
  });

  it('throws when APP_ROLE is invalid', () => {
    expect(() => parseAppConfig(validEnv({ APP_ROLE: 'bogus' }))).toThrow(/APP_ROLE/);
  });

  it('throws when JWT secret too short', () => {
    expect(() => parseAppConfig(validEnv({ JWT_ACCESS_SECRET: 'short' }))).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects legacy MAIL_FROM alias', () => {
    expect(() => parseAppConfig({ ...validEnv(), MAIL_FROM: 'legacy@example.com' })).toThrow(
      /MAIL_FROM.*deprecated|removed/i,
    );
  });
});
