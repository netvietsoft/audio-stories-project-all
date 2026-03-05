import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/constants/auth";

const isSecureContext = () =>
  typeof window !== "undefined" && window.location.protocol === "https:";

export const setAuthCookies = (accessToken: string, refreshToken: string) => {
  if (typeof document === "undefined") {
    return;
  }

  const secure = isSecureContext() ? "; Secure" : "";
  document.cookie = `${ACCESS_TOKEN_KEY}=${encodeURIComponent(accessToken)}; Path=/; Max-Age=${60 * 60}; SameSite=Lax${secure}`;
  document.cookie = `${REFRESH_TOKEN_KEY}=${encodeURIComponent(refreshToken)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
};

export const clearAuthCookies = () => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${ACCESS_TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${REFRESH_TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};
