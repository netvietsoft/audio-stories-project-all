# 🧭 FRONTEND WEB — Bản đồ + chi tiết + cạm bẫy

> MỤC ĐÍCH: Tài liệu vùng **Frontend WEB** của monorepo audio-stories.
> App Next.js 16 (App Router) đặt tại `fe/apps/web`. Đọc file này trước khi sửa
> route / api-client / auth / i18n / state ở web.
> Dựa trên đọc code thật. Đường dẫn gốc: `D:\SetupC\Projects\NovelApp\backend\fe\apps\web`.
> Cập nhật: 2026-06-27.

═══════════════════════════════════════════════════════════════════════
## 0. TÓM TẮT NHANH (đọc 30 giây)
═══════════════════════════════════════════════════════════════════════
- **Stack**: Next.js `16.1.0` (App Router, Turbopack) + React `19.2.3` + Tailwind 4
  + next-intl 4 + TanStack Query 5 + Zustand 5 + Axios + next-pwa.
- **Cổng dev**: `3001` (`next dev -p 3001 -H 0.0.0.0`). BE mặc định `:3000`.
- **i18n**: locale luôn nằm ở segment đầu URL → `/[lang]/...` (`vi` | `en`, mặc định `vi`).
  Middleware tự redirect `/` → `/vi` (hoặc theo `Accept-Language` / cookie `NEXT_LOCALE`).
- **Gọi BE**: 2 đường —
  (a) **Axios `apiClient`** (client-side, đính kèm Bearer + tự refresh) → `lib/api/api-client.ts`.
  (b) **BFF route handlers** trong `app/api/public/**` (server proxy, cache no-store) cho dữ liệu public.
- **Auth**: access_token (~1h, JS-readable cookie + localStorage + Zustand) +
  refresh_token (**HttpOnly cookie do BE quản lý**, JS KHÔNG đọc được). 401 → tự refresh 1 lần.
- ⚠️ **CẠM BẪY LỚN NHẤT**: BE bọc response trong `{ data: ... }`. Axios cũng bọc `{ data: ... }`.
  → Khi dùng `apiClient.get()` trực tiếp phải lấy `response.data.data` (DOUBLE UNWRAP).
  Quên sẽ ra `undefined`/render rỗng — chính là bug từng gặp ở `HomePageClient`. Xem mục 6.

═══════════════════════════════════════════════════════════════════════
## 1. CẤU TRÚC THƯ MỤC `src/`
═══════════════════════════════════════════════════════════════════════
```
src/
  app/                       # App Router
    layout.tsx               # Root layout (<html lang="vi">, font Be Vietnam Pro, CustomHeadScripts)
    [lang]/                  # ★ Segment locale — MỌI route người dùng nằm dưới đây
      layout.tsx             # NextIntlClientProvider + ThemeProvider + AppProviders + AudioProvider + AuthModal
      (main)/                # Route group có Navbar + Footer (LayoutWrapper)
      (auth)/                # Route group auth (forgot-password) — KHÔNG có Navbar
      auth/google/callback/  # OAuth Google callback (bản trong [lang])
      music/                 # Khu nhạc nền (music player)
      notifications/
    api/                     # ★ Route handlers (BFF / server) — KHÔNG bị middleware đụng
      public/stories/explore/route.ts
      public/stories/[slug]/route.ts
      avatar/delete/route.ts
      uploadthing/(core|route).ts
    auth/google/callback/    # OAuth callback (bản KHÔNG locale)
    robots.ts / sitemap.ts / not-found.tsx / globals.css / icon.svg
  auth/                      # auth-provider.tsx (Context), use-auth.ts, with-auth.tsx (HOC)
  components/                # UI: auth/, layout/, player/, story/, music/, shared/, payment/, profile/, upload/, ads/, seo/
  config/env.ts             # Zod validate NEXT_PUBLIC_* (DUY NHẤT 3 biến)
  constants/auth.ts         # Khoá storage, endpoint refresh, base URL, protected prefixes
  hooks/                     # use-api (axios+RQ), use-view-tracking, use-active-advertisements, useDebounce...
  i18n.ts                    # locales = [vi, en], defaultLocale=vi, isValidLocale, localeCookieName
  i18n/request.ts           # getRequestConfig (next-intl) — chọn messages theo cookie/requestLocale
  lib/                       # api/, auth/cookies.ts, music/, player/, ads/, tracking/, validation/, story-localization
  providers/                # app-providers (QueryClient+AuthProvider), audio-provider
  store/ + stores/          # ⚠️ HAI thư mục store song song (xem mục 5 — lỗi cấu trúc)
  types/                     # admin, advertisement, music, custom.d.ts
```
> `messages/{vi,en}.json` nằm NGOÀI `src` (ở `fe/apps/web/messages`).
> `middleware.ts` nằm ở gốc app, dùng package chung `@audio-stories/shared/*`.

═══════════════════════════════════════════════════════════════════════
## 2. ROUTING & LOCALE `[lang]`
═══════════════════════════════════════════════════════════════════════

### 2.1 Middleware (`middleware.ts`) — chạy trên Edge
Logic (dùng helper từ `@audio-stories/shared/middleware`):
1. `shouldSkipMiddlewarePath` → bỏ qua asset/api.
2. Nếu URL **chưa có** prefix locale → redirect sang `/{locale}{path}`
   (`detectLocaleFromHeaders` đọc `Accept-Language`), set cookie `NEXT_LOCALE`.
3. Nếu route thuộc `AUTH_PROTECTED_PREFIXES` (`/dashboard`, `/library`, `/profile`, `/player`)
   mà KHÔNG có cookie `access_token` → redirect `/{locale}/login?redirect=...`.
4. Nếu vào `/login` hoặc `/register` mà ĐÃ có token → redirect về home.
5. Mọi response set lại cookie `NEXT_LOCALE`.
- `matcher`: tất cả TRỪ `api`, `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt`, `manifest.json`.

⚠️ **Cạm bẫy**: protected-route guard ở middleware CHỈ dựa vào sự tồn tại của cookie
`access_token` (JS-readable, set bởi `setAuthCookies`, Max-Age 1h). Cookie hết hạn sau 1h
nhưng refresh_token (HttpOnly) còn → middleware sẽ đá user về login dù phiên vẫn hợp lệ.
Không có cơ chế “refresh tại middleware”.

⚠️ Route `/login` và `/register` **không tồn tại dưới dạng page** trong `src/app/[lang]`
(không thấy thư mục `login`/`register`). Đăng nhập thực tế qua **AuthModal** (mục 4).
Vậy nếu user bị middleware đẩy tới `/{locale}/login` → khả năng 404 (CẦN kiểm chứng — xem PHẦN CÒN THIẾU).

### 2.2 Bản đồ route (dưới `/[lang]`)
Route group `(main)` (có Navbar + Footer):

| Route (sau prefix locale) | File | Trạng thái | Ghi chú |
|---|---|---|---|
| `/` | `(main)/page.tsx` | done | **Landing choice** (chọn Truyện / Nhạc), KHÔNG phải home truyện |
| `/story` | `(main)/story/page.tsx` | done | Render `HomePageClient` với `initialData` RỖNG → fetch toàn bộ ở client |
| `/story/explore` | `story/explore/page.tsx` | done | Khám phá có filter |
| `/story/new` | `story/new/page.tsx` | done | Truyện mới |
| `/story/trending` | `story/trending/page.tsx` | done | |
| `/story/ranking` | `story/ranking/page.tsx` | done | |
| `/story/vinh-danh` | `story/vinh-danh/page.tsx` | done | Hall of fame |
| `/story/interactive` | `story/interactive/page.tsx` | done | Truyện tương tác |
| `/story/search` | `story/search/page.tsx` | done | |
| `/story/stories` | `story/stories/page.tsx` | done | Danh sách thể loại |
| `/story/stories/[slug]` | `story/stories/[slug]/page.tsx` | done | |
| `/story/categories` + `/[slug]` | `story/categories/...` | done | |
| `/story/[slug]` | `story/[slug]/page.tsx` + `_components/StoryDetailClient.tsx` | done | Chi tiết truyện |
| `/story/[slug]/[chapterSlug]` | `.../page.tsx` + `_components/StoryChapterClient.tsx` | done | Trang đọc/nghe chương |
| `/music`, `/music/[slug]` | `[lang]/music/...` | done | Khu nhạc (NGOÀI group `(main)`) |
| `/profile` … | `(main)/profile/**` | partial | Xem mục 2.3 |
| `/topup`, `/topup/success` | `(main)/topup/...` | done | Nạp tiền (cũng có dưới `/profile/topup`) |
| `/about /contact /faq /help /terms /privacy /dmca` | `(main)/<x>/page.tsx` | done | Trang tĩnh |
| `/notifications` | `[lang]/notifications/page.tsx` | done | NGOÀI group `(main)` |
| `/forgot-password` | `[lang]/(auth)/forgot-password/page.tsx` | done | Group `(auth)` không Navbar |
| `/auth/google/callback` | `[lang]/auth/google/callback/page.tsx` | done | Xử lý OAuth Google |

⚠️ **Trùng route nghiêm trọng (lỗi cấu trúc)**: tồn tại CẢ HAI cây route:
- cây **cũ** không prefix `story`: `(main)/new`, `(main)/trending`, `(main)/ranking`,
  `(main)/vinh-danh`, `(main)/stories`, `(main)/categories`, `(main)/search`,
  `(main)/explore`, `(main)/interactive`, `(main)/story` (landing), `(main)/HomePageClient`.
- cây **mới** có prefix `story`: `(main)/story/new`, `.../story/trending`, …
`next.config.ts > redirects()` redirect cây cũ → cây mới (`/:lang/new` → `/:lang/story/new`, v.v.).
→ Cây cũ vẫn còn file nhưng bị redirect; **dễ sửa nhầm file không dùng**. Nên xoá cây cũ sau khi
xác nhận redirect ổn (PHẦN CÒN THIẾU).

### 2.3 Nhóm `/profile/**`
`(main)/profile/{page,layout}` + `favorites, history, music-history, playlists/[id],
settings, topup/{page,success}, transactions, unlocked-stories, unlocked-music`.
Trạng thái: **partial** — phần lớn page tự fetch qua `apiClient`, cần token. Middleware bảo vệ
prefix `/profile` (xem 2.1).

### 2.4 `LocalizedLink` (`components/shared/LocalizedLink.tsx`)
⚠️ **LUÔN dùng `LocalizedLink` thay vì `next/link` cho link nội bộ** — nó tự chèn prefix locale
hiện tại (đọc `useParams().lang`). Nếu href đã có `/vi` `/en` hoặc là external (`//`, `http`)
thì để nguyên. Dùng `next/link` trần → mất prefix → middleware redirect lại → nhấp nháy/chậm.

### 2.5 Đổi ngôn ngữ (`components/layout/LanguageSwitcher.tsx`)
- Set cookie `NEXT_LOCALE`, rồi `router.push("/{locale}")` + `router.refresh()`.
⚠️ **Lỗi UX**: chuyển ngôn ngữ luôn đẩy về trang gốc `/{locale}` (mất trang hiện tại + query).
Nên đổi sang giữ `pathname` (đã import `usePathname/useSearchParams` nhưng KHÔNG dùng → dead code).

═══════════════════════════════════════════════════════════════════════
## 3. GỌI BACKEND — API CLIENT
═══════════════════════════════════════════════════════════════════════

### 3.1 Axios instance (`lib/api/api-client.ts`) — đường chính client-side
- `baseURL = API_BASE_URL = env.NEXT_PUBLIC_API_URL` (mặc định `http://localhost:3000`).
- `withCredentials: true` → trình duyệt gửi/nhận HttpOnly cookie (refresh_token).
- **Request interceptor**: lấy token từ `useUserStore.accessToken` HOẶC `localStorage[access_token]`,
  set header `Authorization: Bearer ...`.
- **Response interceptor (401)**: nếu 401 và chưa retry → gọi `/auth/refresh` (qua `refreshClient`,
  KHÔNG body — dựa cookie HttpOnly), nhận `access_token` mới, cập nhật store + localStorage,
  rồi **replay** request gốc 1 lần (`_retry`). Refresh fail → `clearAuth()`. Dùng
  `refreshTokenPromise` để gộp nhiều 401 đồng thời thành 1 lần refresh (single-flight).
- ⚠️ Chỉ retry khi **401** (không xử lý 403). BE dùng 401 cho token hết hạn.
- ⚠️ `apiClient.ts` (camelCase) chỉ là **re-export** của `api-client.ts`. Đừng nhầm 2 file.

### 3.2 Hook `useApi` / `useApiQuery` / `useApiMutation` (`hooks/use-api.ts`)
- `useApi().get<T>()` → trả `response.data` (đã unwrap 1 lớp axios). Vậy `T` nên là `{ data: ... }`
  của BE → vẫn phải lấy `.data` lần nữa ở chỗ dùng (xem 6).
- `useApiQuery(key, url, config, options)` bọc TanStack `useQuery`, queryFn trả `response.data`.
- `useApiMutation(url, method)` bọc `useMutation`.
- `hooks/useApi.ts` (camelCase) = re-export của `use-api.ts`.

### 3.3 BFF route handlers (`app/api/public/**`) — đường server-side cho public data
- `GET /api/public/stories/explore` → proxy thẳng tới `${NEXT_PUBLIC_API_URL}/stories/explore?<query>`,
  `cache: "no-store"`, trả nguyên body BE (giữ nguyên bọc `{ data }`). Lỗi → `502`.
- `GET /api/public/stories/[slug]` → tương tự tới `/stories/{slug}`.
- Helper `lib/api/public-story-cache.ts > fetchExploreCached(params)` gọi BFF này (relative `/api/public/...`),
  trả thẳng JSON BE (kiểu `{ data: StoryItem[] }`).
- ⚠️ Tên file `public-story-cache` gây hiểu nhầm: **KHÔNG có cache thật** — BFF set `no-store`,
  fetch client cũng không cache. Chỉ là một wrapper. (Lỗi đặt tên — nên đổi hoặc thêm revalidate.)
- Mục đích BFF: giấu URL BE thật khỏi client + tránh CORS cho dữ liệu public + cho phép SSR/edge fetch.

### 3.4 Cấu hình env (`config/env.ts`)
Zod validate đúng 3 biến public:
- `NEXT_PUBLIC_API_URL` (url, default `http://localhost:3000`)
- `NEXT_PUBLIC_AUTH_LOGIN_PATH` (default `/login`)
- `NEXT_PUBLIC_AUTH_HOME_PATH` (default `/`)
⚠️ Nhiều file khác đọc trực tiếp `process.env.NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_R2_URL`,
`NEXT_PUBLIC_UPLOADTHING_URL` (BFF routes, `story/page.tsx`, `next.config.ts`) — KHÔNG qua schema
→ không được validate. Nên gom vào `env.ts`.

═══════════════════════════════════════════════════════════════════════
## 4. AUTH FRONTEND
═══════════════════════════════════════════════════════════════════════

### 4.1 Mô hình token
| Token | Nơi lưu | JS đọc? | Thời hạn FE | Ghi chú |
|---|---|---|---|---|
| access_token | Zustand `useUserStore` + `localStorage[access_token]` + cookie `access_token` | Có | cookie Max-Age **1h** | cookie để middleware đọc (SSR guard) |
| refresh_token | **HttpOnly cookie do BE set** | KHÔNG | (BE quản) | JS không bao giờ chạm; gửi tự động nhờ `withCredentials` |

- `lib/auth/cookies.ts`: `setAuthCookies(accessToken)` chỉ set cookie `access_token`
  (`Path=/; Max-Age=3600; SameSite=Lax; Secure` nếu https). `clearAuthCookies()` xoá nó.
  KHÔNG đụng refresh_token (chỉ BE clear được qua Set-Cookie ở `/auth/logout`).

### 4.2 `AuthProvider` (`auth/auth-provider.tsx`) — nguồn sự thật auth ở React
- Context cung cấp: `user, accessToken, isAuthenticated, isLoading, login, logout, refreshProfile`.
- `login({email,password})`: POST `/auth/login` → lấy `access_token` (từ `response.data.access_token`),
  GET `/auth/me` (gắn Bearer thủ công) → `normalizeUserProfile` (map snake_case BE → camelCase FE),
  `setAuth(...)` + `setAuthCookies(...)`.
- `refreshProfile()`: GET `/auth/me`; 401 → `logout()`.
- `bootstrap` (useEffect): nếu có `accessToken` mà chưa có `user` → gọi `refreshProfile`.
- `logout()`: `clearAuth()` (store) + `clearAuthCookies()`. ⚠️ **Không gọi BE `/auth/logout`**
  → refresh_token HttpOnly KHÔNG bị huỷ phía server. Lỗ hổng: phiên vẫn refresh được nếu cookie còn.
- ⚠️ BE trả `sub` làm id (JWT payload), `avatar_url`, `pulse_balance`/`credits`, `premium_expires_at`,
  `vip_tier`. `normalizeUserProfile` map các field này — nếu BE đổi tên → user hiển thị sai.

### 4.3 AuthModal (`components/auth/AuthModal.tsx`) + `stores/auth-modal-store.ts`
- Đăng nhập/đăng ký/quên mật khẩu/verify thực hiện qua **modal toàn cục** (mount ở `[lang]/layout.tsx`),
  KHÔNG phải trang riêng. Store Zustand điều khiển: `openLogin/openRegister/openForgot/openReset/openVerify/close`.
- Form con: `LoginForm, RegisterForm, ForgotForm, ResetForm, VerifyEmailForm, CodeInput, GoogleOAuthBtn`.
- OAuth Google: nút → BE → callback page `[lang]/auth/google/callback` + `GoogleCallbackHandler`.

### 4.4 HOC `with-auth.tsx`
- `withAuth(Component)` — HOC bảo vệ client component (CẦN kiểm chứng cách dùng; ít nơi dùng).

═══════════════════════════════════════════════════════════════════════
## 5. STATE (Zustand) & PROVIDERS
═══════════════════════════════════════════════════════════════════════

### Providers (lồng trong `[lang]/layout.tsx`)
```
NextIntlClientProvider (locale + messages)
 └ ThemeProvider (next-themes, class, default light, enableSystem=false)
   └ AppProviders (QueryClientProvider staleTime 30s + AuthProvider)
     └ AudioProvider
       └ {children} + <AuthModal/>
```

### Stores
| Store | File | Persist | Vai trò |
|---|---|---|---|
| `useUserStore` | `stores/user-store.ts` | localStorage `user-store` (user + accessToken) | ★ Nguồn auth chính, dùng trong interceptor |
| `useAuthStore` | `store/authStore.ts` | localStorage `auth-store` | ⚠️ **TRÙNG LẶP** — store auth thứ 2, cũ |
| `useAuthModalStore` | `stores/auth-modal-store.ts` | không | Điều khiển AuthModal |
| `useAudioStore` | `stores/audio-store.ts` | localStorage `audio-player-store` | Queue/track/volume/repeat/shuffle/speed |
| `useFavoriteStore` | `stores/favorite-store.ts` | — | Trạng thái yêu thích |

⚠️ **LỖI CẤU TRÚC**: tồn tại **hai thư mục** `store/` và `stores/`, và **hai store auth**
(`useUserStore` ở `stores/` vs `useAuthStore` ở `store/`). `authStore.ts` có cả
`getAccessToken()` đọc localStorage + redirect cứng `window.location.href = "/login"` khi logout
(không tôn trọng locale → mất prefix). Nên hợp nhất về `useUserStore`/`AuthProvider` và xoá `store/authStore.ts`.

═══════════════════════════════════════════════════════════════════════
## 6. ★ CẠM BẪY UNWRAP `{ data }` (bug HomePageClient) — ĐỌC KỸ
═══════════════════════════════════════════════════════════════════════
BE bọc payload trong `{ data: <thứ thật> }`. Axios lại bọc HTTP body trong `response.data`.
→ Với một list, để lấy mảng thật bạn phải **bóc 2 lớp**:

```ts
// SAI (chỉ bóc 1 lớp axios) → nhận { data: [...] }, render rỗng vì map trên object:
const stories = (await apiClient.get<StoryItem[]>("/stories/explore")).data; // = { data: [...] } ✗

// ĐÚNG (bóc cả lớp BE):
const res = await apiClient.get<{ data: StoryItem[] }>("/stories/explore");
const stories = res.data.data ?? [];                                          // = [...] ✓
```

Bằng chứng trong code `HomePageClient.tsx` (đã xử lý đúng nhưng KHÔNG nhất quán):
- Có chỗ bóc đúng kiểu phòng thủ:
  `apiClient.get(...).then(r => (Array.isArray(r.data) ? r.data : r.data?.data) || [])`
  (dùng cho `/chapters/latest`, `/stories/categories`, `/stories/authors`) — vì BE đôi khi trả
  **mảng trần**, đôi khi `{ data }`. ⚠️ **BE không nhất quán hình dạng response** giữa các endpoint.
- Có chỗ bóc `r.data?.data` cho `/stories/categories/top`, `/stories/hall-of-fame`, `/banners`.
- Personalized: `favoriteRes.value.data.data` (axios `.data` → BE `{ data }` → `.data` lần 2),
  rồi còn `.data || []` lần 3 ở `favoriteRes.value.data.data || []`.
- `fetchExploreCached<ExploreResponse>(...)` trả thẳng JSON BE (`{ data: [...] }`) nên dùng
  `res.value.data` (1 lớp, vì fetch đã `.json()` rồi — KHÁC axios).

**Quy tắc vàng**:
1. Qua **axios `apiClient`** → kết quả là `response.data`; muốn payload BE phải `.data.data`.
2. Qua **`fetch`/BFF/`fetchExploreCached`** → `await res.json()` đã là body BE `{ data }`,
   chỉ cần `.data` 1 lần.
3. Vì BE trả lúc `{data}` lúc mảng trần → **luôn phòng thủ**:
   `(Array.isArray(x) ? x : x?.data) ?? []`.
4. `grep` cho thấy pattern `.data.data` / `.value.data` xuất hiện **51 lần / 24 file** → đây là
   quy ước ngầm toàn app, dễ sai khi thêm endpoint mới.

═══════════════════════════════════════════════════════════════════════
## 7. i18n (next-intl 4)
═══════════════════════════════════════════════════════════════════════
- `src/i18n.ts`: `locales = ["vi","en"]`, `defaultLocale="vi"`, cookie `NEXT_LOCALE`, `isValidLocale`.
- `src/i18n/request.ts` (`getRequestConfig`): chọn locale theo `requestLocale` → cookie → default;
  load `messages/{vi,en}.json`. Đăng ký plugin ở `next.config.ts` (`createNextIntlPlugin('./src/i18n/request.ts')`).
- `[lang]/layout.tsx`: validate `lang` (sai → `notFound()`), `setRequestLocale(lang)`, **import trực tiếp**
  `messages/{lang}.json` rồi truyền cho `NextIntlClientProvider`.
  ⚠️ Layout import messages **trực tiếp** thay vì dùng `getMessages()` → 2 cơ chế load song song
  (request.ts vs layout). Dễ lệch nếu chỉ sửa 1 nơi.
- Dùng: `useTranslations("Namespace")` (client) / `getTranslations({locale, namespace})` (server).
- Localize dữ liệu động (title/desc/category theo `vi`/`en`): `lib/story-localization.ts >
  getLocalizedValue(locale, viValue, enValue, fallback)`.

═══════════════════════════════════════════════════════════════════════
## 8. TRANG CHỦ TRUYỆN (`HomePageClient`) — luồng dữ liệu
═══════════════════════════════════════════════════════════════════════
File: `app/[lang]/(main)/HomePageClient.tsx` (client component).
- Render bởi `(main)/story/page.tsx` với `initialData` **rỗng** → mọi dữ liệu fetch ở client trong `useEffect`.
- 2 effect:
  1. `loadHome` (deps `[lang, t]`): `Promise.allSettled` ~10 nguồn (explore mới/rating/views/completed,
     `/chapters/latest`, `/stories/categories/top`, `/stories/categories`, `/stories/authors`,
     `/stories/hall-of-fame`, `/banners`), rồi fetch tiếp stories theo category (action, xuyen-khong,
     shounen, tien-hiep + 8 category hiển thị). Dùng `fetchExploreCached` (BFF) + `apiClient`.
  2. `loadPersonalized` (deps `[accessToken]`): nếu có token → `/favorites` + `/history` (limit 3).
- Render trả về `[heroSection, mainContent]` (array element) → `LayoutWrapper` tách hero full-width.
- Trạng thái: **done** nhưng **không SSR dữ liệu** (initialData rỗng) → first paint trống, SEO yếu cho
  danh sách; chỉ metadata tĩnh ở `story/page.tsx`/`home-page-wrapper.tsx` có JSON-LD breadcrumb.
- ⚠️ `home-page-wrapper.tsx` tồn tại (SSR breadcrumb + `await import('./page')`) nhưng KHÔNG thấy ai
  import nó trong cây route hiện hành → có thể là **dead code** (CẦN kiểm chứng).

═══════════════════════════════════════════════════════════════════════
## 9. CÁC HỆ THỐNG PHỤ (tóm tắt)
═══════════════════════════════════════════════════════════════════════
- **Audio player**: `providers/audio-provider.tsx` (Howler) + `stores/audio-store.ts` +
  `components/player/*` (GlobalPlayer, StoryAudioPlayerPanel, YouTubePlayerPanel, Sleep/Speed/Volume/
  Shuffle-Repeat controls). Helper: `lib/player/{control-helpers,playback-modes}`.
- **Music**: `[lang]/music/**` + `lib/music/{music-queue, music-interactions, music-comments,
  normalize-music}`. Có khoá nội dung (unlock bằng pulse/credits).
- **Thanh toán/nạp**: `components/payment/{PaymentMethodSelector, VietQRPayment}` + `/topup`.
- **Upload**: UploadThing (`app/api/uploadthing/*`, `lib/uploadthing.ts`, `components/upload/*`,
  `lib/api/upload-media.ts`); xoá avatar qua BFF `app/api/avatar/delete/route.ts`.
- **Quảng cáo**: `hooks/use-active-advertisements`, `use-ad-insertion-frequency`,
  `lib/ads/interleave-ads`, `components/ads/InlineAdvertisementCard`.
- **Tracking**: `hooks/use-view-tracking`, `lib/tracking/device-id`.
- **SEO**: `app/robots.ts`, `app/sitemap.ts`, `components/seo/JsonLd`, `Breadcrumbs`.
- **PWA**: `@ducanh2912/next-pwa` (tắt ở dev), manifest `/manifest.json`.

═══════════════════════════════════════════════════════════════════════
## 10. TRẠNG THÁI TỔNG & PHẦN CÒN THIẾU
═══════════════════════════════════════════════════════════════════════
**Trạng thái**: phần lớn route **done** (chạy được, fetch client). Auth/i18n/player **done**.
Profile **partial**. SSR dữ liệu danh sách **chưa có** (initialData rỗng).

**PHẦN CÒN THIẾU / TODO**:
- [ ] Trang `/login`, `/register` dạng page (middleware redirect tới nhưng có thể 404 — auth chỉ qua modal).
- [ ] `logout()` chưa gọi BE `/auth/logout` để huỷ refresh_token HttpOnly.
- [ ] SSR/ISR cho HomePageClient (đang fetch toàn bộ client → first paint trống, SEO list yếu).
- [ ] Cache thật cho `public-story-cache` (hiện no-store, tên gây hiểu nhầm).
- [ ] LanguageSwitcher giữ pathname + query khi đổi ngôn ngữ.

**LỖI CẤU TRÚC / LOGIC CẦN REFACTOR**:
1. **Trùng cây route** `(main)/<x>` (cũ) vs `(main)/story/<x>` (mới) — chỉ redirect, file cũ còn → xoá cây cũ.
2. **Hai store auth** (`stores/user-store.ts` vs `store/authStore.ts`) + **hai thư mục** `store/`/`stores/` → hợp nhất.
3. **Hai file api-client / use-api** (kebab vs camel) — camel chỉ re-export, giữ 1 quy ước.
4. **Response BE không nhất quán** (mảng trần vs `{data}`) → mọi nơi phải phòng thủ unwrap (mục 6).
5. `env.ts` thiếu nhiều `NEXT_PUBLIC_*` đang dùng trực tiếp `process.env`.
6. i18n load messages 2 cơ chế (layout import trực tiếp vs request.ts).
7. `home-page-wrapper.tsx` nghi dead code; LanguageSwitcher import `usePathname/useSearchParams` không dùng.
8. Middleware guard chỉ dựa cookie access_token 1h, không refresh → false-logout sau 1h.
