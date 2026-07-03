// Set a public-read CORS policy on the R2 bucket so hls.js (browser, cross-origin)
// can fetch m3u8 + .ts segments. Public audio = no credentials, so '*' origin is safe.
// Usage: node scripts/r2-set-cors.mjs [path-to-.env]
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';

const envPath = process.argv[2]
  ? new URL(`file://${process.argv[2].replace(/\\/g, '/')}`)
  : new URL('../.env', import.meta.url);
const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

// Prefer an ADMIN token passed via process env (so the secret never lands in .env
// or the chat); fall back to the app token in .env (object-only → likely 403 here).
const accessKeyId =
  process.env.R2_ADMIN_ACCESS_KEY_ID ?? env.R2_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.R2_ADMIN_SECRET_ACCESS_KEY ?? env.R2_SECRET_ACCESS_KEY;

const s3 = new S3Client({
  endpoint: env.R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId, secretAccessKey },
});
const Bucket = env.R2_BUCKET_NAME;

await s3.send(
  new PutBucketCorsCommand({
    Bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ['*'],
          AllowedMethods: ['GET', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
console.log(`PutBucketCors OK on bucket "${Bucket}"`);

const got = await s3.send(new GetBucketCorsCommand({ Bucket }));
console.log('Current CORS rules:');
console.log(JSON.stringify(got.CORSRules, null, 2));
