import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';

/** Subclass seam: thay verifier thật bằng fake — không gọi Google trong test. */
class TestAuthService extends AuthService {
  constructor(private readonly fakeVerify: (opts: unknown) => Promise<unknown>) {
    super(null as any, null as any, null as any, null as any, null as any, null as any);
  }
  protected getGoogleVerifier(): OAuth2Client {
    return { verifyIdToken: this.fakeVerify } as unknown as OAuth2Client;
  }
}

describe('AuthService.verifyGoogleIdToken', () => {
  const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  let envBackup: string | undefined;

  beforeEach(() => {
    envBackup = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  });
  afterEach(() => {
    if (envBackup === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = envBackup;
  });

  const payload = {
    sub: 'g-123',
    email: 'a@b.c',
    email_verified: true,
    name: 'Anh A',
    picture: 'https://p.example/a.jpg',
  };

  it('map payload hợp lệ → GoogleUserData (audience = GOOGLE_CLIENT_ID)', async () => {
    let seenOpts: any;
    const svc = new TestAuthService(async (opts) => {
      seenOpts = opts;
      return { getPayload: () => payload };
    });
    const out = await svc.verifyGoogleIdToken('tok-1');
    expect(seenOpts).toEqual({ idToken: 'tok-1', audience: CLIENT_ID });
    expect(out).toEqual({
      provider: 'google',
      provider_user_id: 'g-123',
      email: 'a@b.c',
      name: 'Anh A',
      avatar_url: 'https://p.example/a.jpg',
      raw: payload,
    });
    expect((out.raw as any).email_verified).toBe(true); // upsertGoogleUser cần cờ này
  });

  it('verifier throw (token sai/hết hạn) → UnauthorizedException', async () => {
    const svc = new TestAuthService(async () => {
      throw new Error('invalid signature');
    });
    await expect(svc.verifyGoogleIdToken('bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('payload rỗng/thiếu sub → UnauthorizedException', async () => {
    const svc = new TestAuthService(async () => ({ getPayload: () => undefined }));
    await expect(svc.verifyGoogleIdToken('tok')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('email_verified !== true → UnauthorizedException', async () => {
    const svc = new TestAuthService(async () => ({
      getPayload: () => ({ ...payload, email_verified: false }),
    }));
    await expect(svc.verifyGoogleIdToken('tok')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('GOOGLE_CLIENT_ID thiếu/placeholder → ServiceUnavailableException', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const svc = new TestAuthService(async () => ({ getPayload: () => payload }));
    await expect(svc.verifyGoogleIdToken('tok')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
