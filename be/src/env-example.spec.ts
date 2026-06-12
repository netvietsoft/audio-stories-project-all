import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnvKeys(fileContents: string) {
  return new Set(
    fileContents
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0]?.trim())
      .filter(Boolean) as string[],
  );
}

describe('.env.example', () => {
  it('documents the full local-dev env contract used by the current backend', () => {
    const envExample = readFileSync(resolve(__dirname, '../.env.example'), 'utf8');
    const keys = [...parseEnvKeys(envExample)];

    expect(keys).toEqual(
      expect.arrayContaining([
        'APP_ROLE',
        'NODE_ENV',
        'HOST',
        'PORT',
        'WEB_ORIGIN',
        'ADMIN_ORIGIN',
        'FRONTEND_URL',
        'CLIENT_URL',
        'ALLOWED_CLIENT_URLS',
        'CORS',
        'COOKIE_DOMAIN',
        'COOKIE_SAME_SITE',
        'COOKIE_SECURE',
        'DATABASE_URL',
        'REDIS_HOST',
        'REDIS_PORT',
        'REDIS_PASSWORD',
        'REDIS_DB',
        'REDIS_URL',
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'JWT_ACCESS_TTL',
        'JWT_REFRESH_TTL',
        'THROTTLE_DISABLED',
        'INTERNAL_API_KEY',
        'ADMIN_EMAIL',
        'ADMIN_PASSWORD',
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_SECURE',
        'SMTP_USER',
        'SMTP_PASS',
        'SMTP_FROM',
        'MAIL_FROM',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_CALLBACK_URL',
        'UPLOADTHING_TOKEN',
        'STORAGE_PROVIDER',
        'R2_TOKEN',
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_SECRET_KEY_ID',
        'R2_BUCKET_NAME',
        'R2_URL',
        'R2_ENDPOINT',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_REGION',
        'AWS_BUCKET_NAME',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'USD_TO_VND_RATE',
        'VIETQR_API_URL',
        'VIETQR_CLIENT_ID',
        'VIETQR_API_KEY',
        'VIETQR_ACCOUNT_NO',
        'VIETQR_ACCOUNT_NAME',
        'VIETQR_BANK_ID',
        'VIETQR_ACQ_ID',
        'VIETQR_TEMPLATE',
        'VIETQR_DEFAULT_TEMPLATE',
        'VIETQR_QR_FORMAT',
        'VIETQR_EXCHANGE_RATE',
        'VIETQR_ORDER_EXPIRY_MINUTES',
        'CASSO_API_URL',
        'CASSO_API_KEY',
        'CASSO_SECURE_TOKEN',
        'CASSO_WEBHOOK_URL',
        'E2E_CLEANUP',
        'TEST_STORY_SLUG',
        'TEST_USER_TOKEN',
        'TEST_ADMIN_TOKEN',
      ]),
    );
  });

  it('keeps local-dev defaults on localhost-style infrastructure', () => {
    const envExample = readFileSync(resolve(__dirname, '../.env.example'), 'utf8');

    expect(envExample).toContain('APP_ROLE=api');
    expect(envExample).toContain('NODE_ENV=development');
    expect(envExample).toContain('DATABASE_URL=mysql://root:root@127.0.0.1:3306/audio_stories_dev');
    expect(envExample).toContain('REDIS_URL=redis://127.0.0.1:6379/0');
    expect(envExample).toContain('WEB_ORIGIN=http://localhost:3001');
    expect(envExample).toContain('ADMIN_ORIGIN=http://localhost:3002');
  });
});
