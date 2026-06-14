import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildSwaggerDocument } from '../src/bootstrap';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildSwaggerDocument(app);
  const outputPath = resolve(__dirname, '..', 'dist', 'openapi.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');
  await app.close();
  console.log(`OpenAPI document written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
