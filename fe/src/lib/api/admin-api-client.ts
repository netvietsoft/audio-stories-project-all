import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL, REFRESH_TOKEN_ENDPOINT } from "@/constants/auth";
import { useAdminStore } from "@/stores/admin-store";

// Admin-specific token keys
export const ADMIN_ACCESS_TOKEN_KEY = "admin_access_token";
export const ADMIN_REFRESH_TOKEN_KEY = "admin_refresh_token";

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

export const adminApiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const adminRefreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let refreshTokenPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshTokenPromise) {
    refreshTokenPromise = (async () => {
      const refreshToken =
        useAdminStore.getState().refreshToken ||
        (typeof window !== "undefined" ? localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY) : null);

      if (!refreshToken) {
        return null;
      }

      try {
        const response = await adminRefreshClient.post<RefreshResponse>(
          REFRESH_TOKEN_ENDPOINT,
          undefined,
          {
            headers: {
              "x-refresh-token": refreshToken,
            },
          },
        );

        const { access_token, refresh_token } = response.data;

        const currentUser = useAdminStore.getState().user;
        if (currentUser) {
          useAdminStore.getState().setAuth({
            user: currentUser,
            accessToken: access_token,
            refreshToken: refresh_token,
          });
        } else {
          useAdminStore.getState().updateAccessToken(access_token);
        }

        if (typeof window !== "undefined") {
          localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, access_token);
          localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refresh_token);
        }

        return access_token;
      } catch {
        useAdminStore.getState().clearAuth();
        if (typeof window !== "undefined") {
          localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
          localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
        }
        return null;
      } finally {
        refreshTokenPromise = null;
      }
    })();
  }

  return refreshTokenPromise;
};

adminApiClient.interceptors.request.use((config) => {
  const headerAccessor = config.headers as
    | { get?: (name: string) => string | undefined; set?: (name: string, value: string) => void }
    | Record<string, unknown>
    | undefined;

  const existingAuthHeader =
    (headerAccessor && typeof headerAccessor.get === "function" ? headerAccessor.get("Authorization") : undefined) ||
    (headerAccessor && typeof headerAccessor === "object"
      ? ((headerAccessor as Record<string, unknown>).Authorization as string | undefined)
      : undefined) ||
    (headerAccessor && typeof headerAccessor === "object"
      ? ((headerAccessor as Record<string, unknown>).authorization as string | undefined)
      : undefined);

  if (existingAuthHeader) {
    return config;
  }

  const accessToken =
    useAdminStore.getState().accessToken ||
    (typeof window !== "undefined" ? localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY) : null);

  if (accessToken) {
    try {
      // @ts-ignore
      if (config.headers && typeof (config.headers as any).set === 'function') {
        // @ts-ignore
        config.headers.set("Authorization", `Bearer ${accessToken}`);
      } else {
        // @ts-ignore
        config.headers = config.headers || {};
        // @ts-ignore
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
    } catch (e) {
      // Fallback
      // @ts-ignore
      config.headers = config.headers || {};
      // @ts-ignore
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  return config;
});

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryRequestConfig | undefined;
    const status = error.response?.status;

    if (!originalRequest || status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes(REFRESH_TOKEN_ENDPOINT)) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const newAccessToken = await refreshAccessToken();

    if (!newAccessToken) {
      return Promise.reject(error);
    }

    try {
      if (originalRequest.headers && typeof (originalRequest.headers as any).set === 'function') {
        // @ts-ignore
        originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
      } else {
        // @ts-ignore
        originalRequest.headers = originalRequest.headers || {};
        // @ts-ignore
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
      }
    } catch (e) {
      // Fallback
      // @ts-ignore
      originalRequest.headers = originalRequest.headers || {};
      // @ts-ignore
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
    }

    return adminApiClient(originalRequest);
  },
);
