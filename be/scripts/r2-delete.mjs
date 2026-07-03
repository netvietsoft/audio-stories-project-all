// Delete R2 objects by key. Run from be/:  node scripts/r2-delete.mjs <key1> <key2> ...
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const keys = process.argv.slice(2);
for (const key of keys) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    console.log('DELETED ->', key);
  } catch (e) {
    console.error('FAIL ->', key, e.name, e.message);
  }
}
