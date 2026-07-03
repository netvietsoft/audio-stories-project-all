import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { ACCESS_TOKEN_KEY } from "@/constants/auth";
import { API_BASE_URL, REFRESH_TOKEN_ENDPOINT } from "@/constants/auth";
import { useUserStore } from "@/stores/user-store";

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  access_token: string;
  // refresh_token is no longer in the response body — it lives in an HttpOnly cookie.
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Required so the browser sends/receives HttpOnly cookies (including refresh_token)
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  // Must be true for the browser to attach the refresh_token HttpOnly cookie
  withCredentials: true,
});

let refreshTokenPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshTokenPromise) {
    refreshTokenPromise = (async () => {
      try {
        // No body or header needed — the browser sends the HttpOnly cookie automatically
        const response = await refreshClient.post<RefreshResponse>(
          REFRESH_TOKEN_ENDPOINT,
          undefined,
        );

        // BE bọc response trong { data: ... } -> access_token ở response.data.data
        const access_token =
          (response.data as any)?.data?.access_token ?? (response.data as any)?.access_token;

        const currentUser = useUserStore.getState().user;
        if (currentUser) {
          useUserStore.getState().setAuth({
            user: currentUser,
            accessToken: access_token,
          });
        } else {
          useUserStore.getState().updateAccessToken(access_token);
        }

        if (typeof window !== "undefined") {
          localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
          // Do NOT store refresh_token — it's an HttpOnly cookie, not accessible to JS
        }

        return access_token;
      } catch {
        useUserStore.getState().clearAuth();
        if (typeof window !== "undefined") {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
        }
        return null;
      } finally {
        refreshTokenPromise = null;
      }
    })();
  }

  return refreshTokenPromise;
};

apiClient.interceptors.request.use((config) => {
  const accessToken =
    useUserStore.getState().accessToken ||
    (typeof window !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null);

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
    } catch {
      // @ts-ignore
      config.headers = config.headers || {};
      // @ts-ignore
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  return config;
});

apiClient.interceptors.response.use(
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
    } catch {
      // @ts-ignore
      originalRequest.headers = originalRequest.headers || {};
      // @ts-ignore
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
    }

    return apiClient(originalRequest);
  },
);
