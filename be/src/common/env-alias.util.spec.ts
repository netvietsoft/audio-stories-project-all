import {
  resolveMailFromAddress,
  resolveVietQrTemplate,
} from './env-alias.util';

describe('env-alias.util', () => {
  it('prefers SMTP_FROM, then MAIL_FROM, then SMTP_USER for outbound mail', () => {
    expect(
      resolveMailFromAddress({
        SMTP_FROM: 'smtp-from@example.com',
        MAIL_FROM: 'legacy-mail-from@example.com',
        SMTP_USER: 'smtp-user@example.com',
      }),
    ).toBe('smtp-from@example.com');

    expect(
      resolveMailFromAddress({
        MAIL_FROM: 'legacy-mail-from@example.com',
        SMTP_USER: 'smtp-user@example.com',
      }),
    ).toBe('legacy-mail-from@example.com');

    expect(
      resolveMailFromAddress({
        SMTP_USER: 'smtp-user@example.com',
      }),
    ).toBe('smtp-user@example.com');
  });

  it('falls back to a safe default mail sender', () => {
    expect(resolveMailFromAddress({})).toBe('no-reply@example.com');
  });

  it('prefers VIETQR_TEMPLATE, then VIETQR_DEFAULT_TEMPLATE, then compact2', () => {
    expect(
      resolveVietQrTemplate({
        VIETQR_TEMPLATE: 'compact2',
        VIETQR_DEFAULT_TEMPLATE: 'print',
      }),
    ).toBe('compact2');

    expect(
      resolveVietQrTemplate({
        VIETQR_DEFAULT_TEMPLATE: 'print',
      }),
    ).toBe('print');

    expect(resolveVietQrTemplate({})).toBe('compact2');
  });
});
