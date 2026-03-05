export type JwtAccessPayload = {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
};

export type JwtRefreshPayload = {
  sub: string;
  jti: string;
};

export interface JwtPayload {
  sub: string;
  email: string;
  [key: string]: any;
}

export interface GoogleUser {
  provider: 'google';
  provider_user_id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  raw?: any;
}
