import {
  getRefreshCookieClearOptions,
  getRefreshCookieOptions,
} from './refresh-cookie.options';

describe('refresh-cookie.options', () => {
  it('defaults to lax, root path, httponly, non-secure outside production', () => {
    expect(getRefreshCookieOptions({ NODE_ENV: 'development' })).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 2592000000,
    });
  });

  it('uses production cookie domain and secure env', () => {
    expect(
      getRefreshCookieOptions({
        NODE_ENV: 'production',
        COOKIE_DOMAIN: '.example.com',
        COOKIE_SAME_SITE: 'none',
        COOKIE_SECURE: 'true',
      }),
    ).toMatchObject({
      domain: '.example.com',
      secure: true,
      sameSite: 'none',
      path: '/',
    });
  });

  it('clear options match set options except maxAge', () => {
    const env = {
      COOKIE_DOMAIN: '.example.com',
      COOKIE_SECURE: 'true',
      COOKIE_SAME_SITE: 'lax',
    };
    expect(getRefreshCookieClearOptions(env)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      domain: '.example.com',
    });
  });
});
