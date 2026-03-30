import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/constants/auth";
import { API_BASE_URL, REFRESH_TOKEN_ENDPOINT } from "@/constants/auth";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import { useUserStore } from "@/stores/user-store";

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let refreshTokenPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshTokenPromise) {
    refreshTokenPromise = (async () => {
      const refreshToken =
        useUserStore.getState().refreshToken ||
        (typeof window !== "undefined" ? localStorage.getItem(REFRESH_TOKEN_KEY) : null);

      if (!refreshToken) {
        return null;
      }

      try {
        const response = await refreshClient.post<RefreshResponse>(
          REFRESH_TOKEN_ENDPOINT,
          undefined,
          {
            headers: {
              "x-refresh-token": refreshToken,
            },
          },
        );

        const { access_token, refresh_token } = response.data;

        const currentUser = useUserStore.getState().user;
        if (currentUser) {
          useUserStore.getState().setAuth({
            user: currentUser,
            accessToken: access_token,
            refreshToken: refresh_token,
          });
        } else {
          useUserStore.getState().updateAccessToken(access_token);
        }

        if (typeof window !== "undefined") {
          localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
          localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
        }

        setAuthCookies(access_token, refresh_token);

        return access_token;
      } catch {
        useUserStore.getState().clearAuth();
        if (typeof window !== "undefined") {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        clearAuthCookies();
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
    // Axios may expose headers as a plain object or an AxiosHeaders instance.
    // Use .set if available, otherwise assign to the object key.
    try {
      // @ts-ignore
      if (config.headers && typeof (config.headers as any).set === 'function') {
        // AxiosHeaders has .set
        // @ts-ignore
        config.headers.set("Authorization", `Bearer ${accessToken}`);
      } else {
        // Fallback for plain object
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        config.headers = config.headers || {};
        // @ts-ignore
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
    } catch (e) {
      // As a last resort, assign to headers object
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
    } catch (e) {
      // Fallback
      // @ts-ignore
      originalRequest.headers = originalRequest.headers || {};
      // @ts-ignore
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
    }

    return apiClient(originalRequest);
  },
);
