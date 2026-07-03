// Quick R2 connectivity test. Reads R2_* from env (no secrets in file).
// Run from be/:  node scripts/r2-test.mjs <suffix>
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_URL } = process.env;
const suffix = process.argv[2] || 'test';

const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const key = `audio/_connectivity/${suffix}.txt`;
try {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: 'r2 connectivity ok',
    ContentType: 'text/plain',
  }));
  console.log('PUT OK   -> bucket=' + R2_BUCKET_NAME + ' key=' + key);
} catch (e) {
  console.error('PUT FAIL ->', e.name, e.message);
  process.exit(1);
}

const url = R2_URL.replace(/\/$/, '') + '/' + key;
try {
  const res = await fetch(url);
  const body = await res.text();
  console.log('GET ' + url + ' -> ' + res.status + ' | body="' + body.slice(0, 40) + '"');
} catch (e) {
  console.error('GET FAIL ->', e.message);
}
