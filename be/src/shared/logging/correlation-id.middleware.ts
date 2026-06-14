import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// Note: `req.id` is already declared on `http.IncomingMessage` by `pino-http`
// (as `id: ReqId`), so we do not redeclare it here to avoid type conflicts.
export const CORRELATION_ID_HEADER = 'x-request-id';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void): void {
    const incoming = req.headers?.[CORRELATION_ID_HEADER.toLowerCase()] as string | undefined;
    const id = incoming && UUID_REGEX.test(incoming) ? incoming : randomUUID();
    req.id = id;
    res.setHeader(CORRELATION_ID_HEADER, id);
    next();
  }
}
