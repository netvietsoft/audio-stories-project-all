// Check HLS pipeline state on R2: list everything under audio/hls/ and audio/music/
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';

// load env file (path from argv[2], default be/.env). Strips surrounding quotes.
const envPath = process.argv[2] ? new URL(`file://${process.argv[2].replace(/\\/g, '/')}`) : new URL('../.env', import.meta.url);
const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const s3 = new S3Client({
  endpoint: env.R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const Bucket = env.R2_BUCKET_NAME;

async function listPrefix(Prefix) {
  const out = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken: token }));
    for (const o of page.Contents ?? []) out.push({ key: o.Key, size: o.Size });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

console.log('Bucket:', Bucket, '| public:', env.R2_URL);
for (const p of ['audio/hls/', 'audio/music/']) {
  const items = await listPrefix(p);
  console.log(`\n=== ${p} (${items.length} objects) ===`);
  for (const it of items.slice(0, 40)) console.log(`  ${(it.size+'').padStart(9)}  ${it.key}`);
  if (items.length > 40) console.log(`  ... +${items.length - 40} more`);
}
