export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const AUTH_LOGIN_PATH = process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH || "/login";
export const AUTH_HOME_PATH = process.env.NEXT_PUBLIC_AUTH_HOME_PATH || "/";

export const AUTH_PROTECTED_PREFIXES = [
  "/profile",
  "/notifications",
  "/topup",
] as const;
