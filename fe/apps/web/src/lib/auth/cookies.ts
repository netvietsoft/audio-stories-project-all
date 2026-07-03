import { ACCESS_TOKEN_KEY } from "@/constants/auth";

const isSecureContext = () =>
  typeof window !== "undefined" && window.location.protocol === "https:";

/**
 * Sets only the access_token as a JS-readable cookie (for SSR middleware).
 * The refresh_token is now managed as a Secure HttpOnly cookie by the backend — do NOT touch it here.
 */
export const setAuthCookies = (accessToken: string) => {
  if (typeof document === "undefined") {
    return;
  }

  const secure = isSecureContext() ? "; Secure" : "";
  document.cookie = `${ACCESS_TOKEN_KEY}=${encodeURIComponent(accessToken)}; Path=/; Max-Age=${60 * 60}; SameSite=Lax${secure}`;
};

/**
 * Clears only the access_token cookie.
 * The refresh_token cookie is HttpOnly — it can only be cleared by the backend via Set-Cookie (logout endpoint).
 */
export const clearAuthCookies = () => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${ACCESS_TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};
