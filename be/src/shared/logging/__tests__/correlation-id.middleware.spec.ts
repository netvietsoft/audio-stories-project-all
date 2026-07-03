import { CorrelationIdMiddleware, CORRELATION_ID_HEADER } from '../correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    req = { headers: {} };
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  it('generates a new id when header missing', () => {
    middleware.use(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, req.id);
    expect(next).toHaveBeenCalled();
  });

  it('reuses incoming header when valid uuid', () => {
    const incoming = '11111111-2222-3333-4444-555555555555';
    req.headers[CORRELATION_ID_HEADER.toLowerCase()] = incoming;
    middleware.use(req, res, next);
    expect(req.id).toBe(incoming);
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, incoming);
  });

  it('rejects malformed header and regenerates', () => {
    req.headers[CORRELATION_ID_HEADER.toLowerCase()] = 'not-a-uuid';
    middleware.use(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.id).not.toBe('not-a-uuid');
  });
});
