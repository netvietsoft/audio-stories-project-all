# `src/` — Frontend WEB (Next.js App Router)

App nghe truyện/nhạc audio. Next 16 + React 19 + Tailwind 4 + next-intl + TanStack Query + Zustand.
Tài liệu chi tiết: `../../../../docs/03-frontend-web.md` (relative tới repo: `docs/03-frontend-web.md`).

## Mục đích thư mục
UI + routing + gọi BE cho web. KHÔNG truy cập DB; chỉ gọi REST BE qua `NEXT_PUBLIC_API_URL`
(và một số BFF route `app/api/public/**`).

## File / thư mục chính
- `app/[lang]/**` — MỌI route nằm dưới segment locale (`vi`/`en`). Group `(main)` có Navbar/Footer,
  `(auth)` không. Cây route truyện đặt dưới `/story/...` (cây cũ không-prefix bị `next.config redirects`).
- `app/api/**` — route handlers (BFF/proxy, uploadthing, avatar delete). KHÔNG bị middleware đụng.
- `lib/api/api-client.ts` — Axios instance (Bearer + auto-refresh 401). `apiClient.ts`/`hooks/useApi.ts` chỉ re-export.
- `auth/auth-provider.tsx` — Context auth (login/logout/refreshProfile). `components/auth/AuthModal.tsx` = UI đăng nhập.
- `stores/user-store.ts` — store auth chính (accessToken). `stores/audio-store.ts` — player.
- `config/env.ts` — Zod validate `NEXT_PUBLIC_*`. `constants/auth.ts` — khoá storage/endpoint.
- `i18n.ts` + `i18n/request.ts` — cấu hình next-intl. `../messages/{vi,en}.json` (ngoài src).
- `../middleware.ts` — redirect locale + guard `/profile,/dashboard,/library,/player`.

## Vào / ra (data flow)
- VÀO: cookie `access_token` (JS) + refresh_token (HttpOnly, BE quản), cookie `NEXT_LOCALE`, BE REST.
- RA: gọi `apiClient.*` (gắn Bearer, tự refresh) hoặc `fetch` BFF `/api/public/**`.

## Cạm bẫy (ĐỌC TRƯỚC KHI SỬA)
- ⚠️ **DOUBLE UNWRAP**: BE bọc `{data}`, axios bọc `response.data` → qua `apiClient` phải lấy
  `res.data.data`. Qua `fetch`/BFF chỉ `res.json().data` (1 lần). BE đôi khi trả mảng trần →
  phòng thủ `(Array.isArray(x) ? x : x?.data) ?? []`. (Bug cũ ở `HomePageClient`.)
- ⚠️ Link nội bộ dùng `components/shared/LocalizedLink` (tự chèn prefix locale), KHÔNG `next/link` trần.
- ⚠️ Hai store auth (`stores/user-store` vs `store/authStore`) + hai thư mục `store/`/`stores/` — dùng `user-store`.
- ⚠️ `logout()` chưa gọi BE `/auth/logout` (refresh_token HttpOnly không bị huỷ server-side).
- ⚠️ Trùng cây route `(main)/<x>` (cũ, redirect) vs `(main)/story/<x>` (mới) — sửa đúng cây mới.

## Trạng thái
Phần lớn route **done** (fetch client). Profile **partial**. Chưa SSR dữ liệu danh sách
(initialData rỗng → first paint trống, SEO list yếu). Xem mục 10 của `docs/03-frontend-web.md`.
