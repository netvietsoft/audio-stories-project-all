## Web Truyen Audio

Nền tảng frontend dùng Next.js App Router + TypeScript + TailwindCSS.

## Stack

- Next.js `16.1.0` (App Router)
- TypeScript strict mode
- TailwindCSS
- ESLint + Prettier
- Zustand (global persistent state)
- Axios + React Query

## Setup

1. Tạo file môi trường:

```bash
cp .env.example .env.local
```

2. Cài dependencies:

```bash
npm install
```

3. Chạy development:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Cấu trúc chính

- `src/config/env.ts`: parse và validate env
- `src/stores/audio-store.ts`: Zustand audio player store (persist)
- `src/stores/user-store.ts`: Zustand user/auth store (persist)
- `src/lib/api/api-client.ts`: Axios instance + interceptor refresh token
- `src/hooks/use-api.ts`: helper hooks cho Axios + React Query
- `src/auth/auth-provider.tsx`: `AuthProvider` + `useAuth`
- `src/auth/with-auth.tsx`: HOC bảo vệ component client
- `middleware.ts`: bảo vệ route ở edge middleware

## Route protection

- Các route có prefix trong `AUTH_PROTECTED_PREFIXES` sẽ yêu cầu access token cookie.
- Route auth (`/login`, `/register`) sẽ tự redirect về home nếu đã login.
