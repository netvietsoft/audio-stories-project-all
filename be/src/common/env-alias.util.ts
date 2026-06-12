export type MailEnvLike = {
  SMTP_FROM?: string;
  MAIL_FROM?: string;
  SMTP_USER?: string;
};

export function resolveMailFromAddress(env: MailEnvLike = process.env): string {
  return (
    env.SMTP_FROM?.trim() ||
    env.MAIL_FROM?.trim() ||
    env.SMTP_USER?.trim() ||
    'no-reply@example.com'
  );
}

export type VietQrEnvLike = {
  VIETQR_TEMPLATE?: string;
  VIETQR_DEFAULT_TEMPLATE?: string;
};

export function resolveVietQrTemplate(env: VietQrEnvLike = process.env): string {
  return env.VIETQR_TEMPLATE?.trim() || env.VIETQR_DEFAULT_TEMPLATE?.trim() || 'compact2';
}
