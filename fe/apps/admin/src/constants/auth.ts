import { env } from "@/config/env";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const AUDIO_STORAGE_KEY = "audio-player-store";
export const USER_STORAGE_KEY = "user-store";

export const API_BASE_URL = env.NEXT_PUBLIC_API_URL;
export const REFRESH_TOKEN_ENDPOINT = "/auth/refresh";

export const AUTH_LOGIN_PATH = env.NEXT_PUBLIC_AUTH_LOGIN_PATH;
export const AUTH_HOME_PATH = env.NEXT_PUBLIC_AUTH_HOME_PATH;

export const AUTH_PROTECTED_PREFIXES = ["/dashboard", "/library", "/profile", "/player"];
