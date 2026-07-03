# 🧭 FRONTEND ADMIN + PACKAGES DÙNG CHUNG — Bản đồ + chi tiết + cạm bẫy

> MỤC ĐÍCH: Tài liệu vùng **Frontend ADMIN** (`fe/apps/admin`) và **packages dùng chung**
> (`fe/packages/shared`, `fe/packages/ui`, `fe/packages/api-client`) của monorepo audio-stories.
> Đọc file này TRƯỚC khi sửa route admin, api-client, auth admin, i18n, hoặc đụng vào packages.
> Dựa trên đọc code THẬT. Gốc: `D:\SetupC\Projects\NovelApp\backend\fe`.
> Cập nhật: 2026-06-27.

═══════════════════════════════════════════════════════════════════════
## 0. TÓM TẮT NHANH (đọc 30 giây)
═══════════════════════════════════════════════════════════════════════
- **Monorepo**: Yarn 4 workspaces (`apps/*`, `packages/*`) + **Moonrepo** điều phối task.
  Node `24.16.0`. 2 app: `web` (cổng 3001) và `admin` (cổng **3002**).
- **Admin stack**: Next.js `16.1.0` (App Router, Turbopack) + React `19.2.3` + Tailwind 4
  + next-intl 4 + TanStack Query 5 + Zustand 5 + Axios + react-hook-form + zod + UploadThing.
- **i18n**: locale ở segment đầu URL → `/[lang]/...` (`vi` | `en`, mặc định `vi`).
  `middleware.ts` redirect `/` → `/vi`, và redirect các URL cũ `/admin`, `/[lang]/admin/...` về không-prefix.
- **Gọi BE**: admin dùng Axios **`adminApiClient`** (`lib/api/admin-api-client.ts`) — đính kèm Bearer
  từ `useAdminStore` / `localStorage('admin_access_token')`, tự refresh 1 lần khi 401.
- **Auth admin**: 2 lớp. (1) `middleware.ts` (server) chỉ chặn khi KHÔNG có cookie `refresh_token`.
  (2) `AdminShellLayout` + `useRequireAdmin` (client) kiểm tra có token/flag → nếu không, redirect `/[lang]/login`.
  Kiểm tra role `ADMIN` CHỈ xảy ra lúc đăng nhập (`login/page.tsx`), KHÔNG enforce lại ở mỗi request.
- ⚠️ **CẠM BẪY LỚN NHẤT 1**: admin gọi `adminApiClient.get(...)` rồi đọc `res.data` (1 lần unwrap của axios).
  BE thường bọc `{ data: ... }` → nhiều page phải tự đọc `res.data.data` hoặc `normalize...`. KHÔNG đồng nhất.
- ⚠️ **CẠM BẪY LỚN NHẤT 2**: tồn tại **3 hệ auth song song chết một nửa** trong cùng app admin:
  `adminApiClient` + `useAdminStore` (đang dùng THẬT), và `api-client.ts` + `auth-provider` + `useUserStore`
  + `store/authStore.ts` (DI SẢN từ web, gần như KHÔNG được page nào dùng). Xem mục 8.
- ⚠️ **CẠM BẪY 3**: `package.json` admin khai báo `@audio-stories/ui` và `@audio-stories/api-client`
  là dependency + `transpilePackages`, NHƯNG admin KHÔNG import 2 package này ở đâu cả. Chỉ dùng `shared`
  (qua `middleware.ts`). `ui` và `api-client` hiện gần như **rỗng** (stub).

═══════════════════════════════════════════════════════════════════════
## 1. KIẾN TRÚC MONOREPO (Yarn workspaces + Moonrepo)
═══════════════════════════════════════════════════════════════════════
Gốc: `fe/package.json` → `name: audio-stories-fe`, `packageManager: yarn@4.15.0`,
workspaces `["apps/*", "packages/*"]`, `engines.node: 24.16.0`.

**Cây project (`fe/.moon/workspace.yml`)**:
```
web       → apps/web        (Next.js, cổng 3001)
admin     → apps/admin      (Next.js, cổng 3002)   ← VÙNG NÀY
shared    → packages/shared (lib TS thuần: i18n, middleware, auth const, env)
ui        → packages/ui     (STUB — index.ts chỉ `export {}`)
apiClient → packages/api-client (chỉ 1 hàm getApiBaseUrl)
```

**Moonrepo điều phối**:
- `fe/.moon/toolchain.yml` — khoá Node `24.16.0` + Yarn `4.15.0`.
- `fe/.moon/tasks.yml` — task chung `lint` / `typecheck` / `build` (build có `deps: ^:build` = build dependency trước).
- `apps/admin/moon.yml` — `type: application`, `dependsOn: [shared, ui, apiClient]`;
  task `dev` (`next dev -p 3002 -H 0.0.0.0`, `local: true`), `start` (`next start -p 3002`), `build`, `typecheck`, `lint`.
- `packages/*/moon.yml` — `type: library`, chỉ có `typecheck` + `build` bằng `tsc`.

**Cách chạy** (từ thư mục `fe`):
```
yarn dev:admin        # = moon run admin:dev  → http://localhost:3002
yarn build            # = moon run :build      (build tất cả project, theo thứ tự deps)
yarn typecheck        # = moon run :typecheck
yarn test:e2e:admin   # = playwright test --project=admin
```
Hoặc trực tiếp trong `apps/admin`: `yarn dev` / `yarn build` / `yarn start` (script package.json admin).

**Quan hệ apps ↔ packages**: package nội bộ tham chiếu qua `workspace:*` trong `package.json`,
import bằng tên `@audio-stories/<pkg>`, được Next biên dịch nhờ `transpilePackages` (next.config.ts).
Package export **source `.ts` trực tiếp** (xem `exports` của từng package), KHÔNG build ra `dist` để app dùng
(build task chỉ phục vụ typecheck/CI). → Sửa package là app thấy ngay khi dev.

═══════════════════════════════════════════════════════════════════════
## 2. CẤU TRÚC `apps/admin/src/`
═══════════════════════════════════════════════════════════════════════
```
src/
  middleware.ts            # (ở apps/admin/middleware.ts, NGOÀI src) i18n + chặn no-refresh-token
  i18n.ts                  # locales = [vi, en], defaultLocale = vi, cookie NEXT_LOCALE
  i18n/request.ts          # next-intl getRequestConfig — nạp messages/{locale}.json
  app/
    layout.tsx             # Root: <html lang="vi">, font Be Vietnam Pro, CustomHeadScripts
    [lang]/                # ★ MỌI route admin nằm dưới segment locale
      layout.tsx           # NextIntlClientProvider + ThemeProvider + AppProviders + AdminShellLayout
      page.tsx             # Dashboard (stats từ /auth/admin/stats)
      login/page.tsx       # Trang đăng nhập admin (KHÔNG dùng AdminShell)
      users/, stories/, music/, banners/, ads/, ads/unlock/, social-links/,
      interactive-stories/, categories/, authors/, memberships/, packages/,
      languages/, comments/, comment-reports/, gifts/, transactions/,
      vip-stories/, settings/, chapters/, variants/   # các trang quản trị (CRUD)
      _actions/revalidate.ts  # server action: revalidateTag('stories-explore')
    api/                   # Route handlers (server, KHÔNG qua middleware)
      uploadthing/         # core.ts (FileRouter: imageUploader 4MB, audioUploader 4GB) + route.ts
      chapter-audio/delete/route.ts     # xoá file audio trên UploadThing (UTApi)
      chapter-thumbnail/delete/route.ts # xoá thumbnail trên UploadThing
  auth/                    # ⚠ DI SẢN web (auth-provider, use-auth, with-auth) — xem mục 8
  components/
    admin/AdminShellLayout.tsx   # ★ Khung admin: sidebar + nav + logout + guard client
    admin/AdminRequireLogin.tsx  # màn loading + redirect khi chưa đăng nhập
    admin/AdminLanguageDropdown.tsx
    layout/Navbar.tsx (66KB), Footer.tsx   # ⚠ component web khổng lồ, không dùng trong admin shell
    auth/*, player/*, music/*, shared/*, upload/*   # phần lớn là di sản web
  config/env.ts            # zod parse NEXT_PUBLIC_* (API URL, login/home path)
  constants/auth.ts        # API_BASE_URL, REFRESH_TOKEN_ENDPOINT, key localStorage...
  hooks/
    useRequireAdmin.tsx    # ★ guard client cho admin (kiểm tra token/flag)
    useAdminLanguages.ts   # fetch /languages cho dropdown
    use-api.ts / useApi.ts # ⚠ wrapper dựa trên apiClient (web) — di sản
    use-*.ts               # tracking, share, ad-frequency... (di sản web)
  lib/
    api/admin-api-client.ts  # ★ Axios admin (Bearer + refresh) — DÙNG THẬT
    api/api-client.ts        # ⚠ Axios web (Bearer + refresh, dựa useUserStore) — di sản
    api/apiClient.ts         # re-export apiClient (web)
    api/upload-media.ts      # uploadAudioToR2 → POST /upload/audio (dùng apiClient web!)
    auth/cookies.ts          # set/clear cookie access_token (JS-readable, cho SSR)
    music/*, player/*, tracking/*, validation/*  # di sản web
  providers/app-providers.tsx  # QueryClientProvider + AuthProvider (web)
  store/authStore.ts        # ⚠ Zustand auth (web) — di sản
  stores/
    admin-store.ts          # ★ Zustand admin (user + accessToken) persist 'admin-store'
    user-store.ts           # ⚠ Zustand user (web) persist 'user-store' — di sản
    audio-store.ts, favorite-store.ts, auth-modal-store.ts  # di sản web
  types/                    # admin.ts, advertisement.ts, music.ts, custom.d.ts
```

═══════════════════════════════════════════════════════════════════════
## 3. ROUTING & RENDER (App Router)
═══════════════════════════════════════════════════════════════════════
- **Root** `app/layout.tsx`: `<html lang="vi">`, font Be Vietnam Pro, `CustomHeadScripts`. KHÔNG có provider.
- **Locale** `app/[lang]/layout.tsx`: server component — `await params`, validate `isValidLocale(lang)`
  (sai → `notFound()`), `setRequestLocale`, **import động** `../../../messages/${lang}.json`,
  rồi bọc `NextIntlClientProvider` → `ThemeProvider` (forced light) → `AppProviders` → `AdminShellLayout`.
- **AdminShellLayout** (`components/admin/AdminShellLayout.tsx`): `"use client"`, là KHUNG mọi trang admin:
  - Tính `pathWithoutLocale` (cắt `/(vi|en)`), nhận biết trang login → nếu login thì render thẳng children
    (không sidebar). Ngược lại gọi `useRequireAdmin(true)` → loading / `AdminRequireLogin` / nội dung.
  - `navItems` = **danh sách menu admin** (hard-code trong file): Dashboard `/`, Users `/users`,
    Stories `/stories`, Music `/music`, Banner `/banners`, Quảng cáo Inline `/ads`, Quảng cáo mở khoá
    `/ads/unlock`, Link Cộng đồng `/social-links`, Truyện Tương Tác `/interactive-stories`,
    Danh mục `/categories`, Tác giả `/authors`, Hội viên `/memberships`, Gói thanh toán `/packages`,
    Ngôn ngữ `/languages`, Bình luận `/comments`, Báo cáo Bình luận `/comment-reports`,
    Lịch sử Tặng quà `/gifts`, Giao dịch `/transactions`, Truyện VIP `/vip-stories`, Cài đặt `/settings`.
  - Logout: xoá localStorage admin keys → `POST /auth/logout` → `useAdminStore.clearAuth()` → push `/[lang]/login`.
- **Hầu hết page là `"use client"`**, tự fetch dữ liệu trong `useEffect` qua `adminApiClient`. KHÔNG dùng RSC fetch.
  TanStack Query có sẵn (`AppProviders`) nhưng phần lớn page admin KHÔNG dùng (fetch thủ công).

═══════════════════════════════════════════════════════════════════════
## 4. AUTH ADMIN — luồng đầy đủ (QUAN TRỌNG)
═══════════════════════════════════════════════════════════════════════
**Đăng nhập** (`app/[lang]/login/page.tsx`):
1. `POST /auth/login {email, password}` → kỳ vọng `data.ok === true` và `data.access_token`.
2. `GET /auth/me` (kèm `Authorization: Bearer <access_token>`) → kiểm tra `role === 'ADMIN'` HOẶC
   `roles.includes('ADMIN')`. Không phải admin → báo lỗi, `clearAuth()`.
3. Là admin → lưu `localStorage`: `admin_access_token`, `adminLoggedIn='true'`, `userEmail`;
   gọi `useAdminStore.setAuth({user, accessToken})`; `router.push('/')` + `refresh()`.

**Token & refresh** (`lib/api/admin-api-client.ts`):
- `adminApiClient` = axios `baseURL=API_BASE_URL`, `withCredentials:true` (để gửi cookie HttpOnly refresh_token).
- Request interceptor: nếu request CHƯA có header Authorization → đính `Bearer` từ
  `useAdminStore.accessToken` HOẶC `localStorage('admin_access_token')`.
- Response interceptor: gặp 401 (không phải request refresh, chưa retry) → `POST /auth/refresh`
  (không body, browser tự gửi cookie) → nhận `access_token` mới → cập nhật store + localStorage → retry 1 lần.
  Refresh fail → `clearAuth()` + xoá localStorage. Có **lock** `refreshTokenPromise` chống refresh đồng thời.

**Guard server** (`apps/admin/middleware.ts`, dùng helper từ `@audio-stories/shared`):
- Bỏ qua `/_next`, `/api`, file tĩnh... (`shouldSkipMiddlewarePath`).
- Redirect URL cũ: `/admin` → `/vi`; `/[lang]/admin/...` → `/[lang]/...` (kèm set cookie NEXT_LOCALE).
- Nếu URL thiếu prefix locale → detect locale (cf-ipcountry / accept-language) rồi redirect thêm `/[lang]`.
- Nếu KHÔNG phải route login VÀ KHÔNG có cookie `refresh_token` → redirect `/[lang]/login?reason=unauthorized`.
  ⚠ Chỉ check **sự tồn tại** cookie refresh_token, KHÔNG verify chữ ký, KHÔNG check role.

**Guard client** (`hooks/useRequireAdmin.tsx`): coi là admin nếu có BẤT KỲ:
`useAdminStore.user` HOẶC `localStorage('adminLoggedIn')==='true'` HOẶC `localStorage('admin_access_token')`.
`autoRedirect=true` → thiếu thì replace `/[lang]/login`. ⚠ KHÔNG kiểm tra role/độ hợp lệ token, chỉ check tồn tại.

═══════════════════════════════════════════════════════════════════════
## 5. PACKAGE `@audio-stories/shared` (DÙNG THẬT)
═══════════════════════════════════════════════════════════════════════
Gốc: `packages/shared/src/`. Export qua subpath (`package.json` exports): `.`, `./auth`, `./env`, `./i18n`, `./middleware`.
- `i18n.ts`: `locales=[vi,en]`, `defaultLocale='vi'`, `localeCookieName='NEXT_LOCALE'`, `isValidLocale()`.
- `auth.ts`: hằng số — `ACCESS_TOKEN_KEY='access_token'`, **`REFRESH_TOKEN_COOKIE='refresh_token'`** (middleware admin dùng),
  `AUTH_LOGIN_PATH`/`AUTH_HOME_PATH` (env, mặc định `/login` `/`), `AUTH_PROTECTED_PREFIXES`.
- `middleware.ts`: helper thuần — `localePrefixMatcher`, `shouldSkipMiddlewarePath`, `detectLocaleFromHeaders`
  (ưu tiên `cf-ipcountry`, rồi `accept-language`), `getLocaleFromRequest`, `stripLocale`.
- `env.ts`: `parsePublicUrl(raw)` → trả `URL | null`.
- ⚠ Admin chỉ import `shared/auth`, `shared/i18n`, `shared/middleware` (trong `apps/admin/middleware.ts`).
  ⚠ TRÙNG LẶP: admin còn có `src/i18n.ts` riêng (cùng nội dung locales/cookie) — 2 nguồn sự thật i18n song song.

═══════════════════════════════════════════════════════════════════════
## 6. PACKAGE `@audio-stories/api-client` (STUB — gần như rỗng)
═══════════════════════════════════════════════════════════════════════
Gốc: `packages/api-client/src/`. Dep: chỉ `axios`. Export `.` và `./http`.
- `http.ts`: DUY NHẤT 1 hàm `getApiBaseUrl()` → `process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"`.
- `index.ts`: `export * from "./http"`.
- ⚠ TÌNH TRẠNG: **stub**. Tên gợi ý "client axios chia sẻ" nhưng KHÔNG có instance axios, interceptor, unwrap.
  ⚠ Admin KHAI BÁO dep + transpile package này nhưng **KHÔNG import** ở đâu. Mỗi app tự dựng axios client riêng
  (admin: `lib/api/admin-api-client.ts`; web: `lib/api/api-client.ts`) → logic refresh/interceptor BỊ NHÂN BẢN.
  → ĐÂY là chỗ nên refactor: gom interceptor/refresh/unwrap vào package này.

═══════════════════════════════════════════════════════════════════════
## 7. PACKAGE `@audio-stories/ui` (STUB)
═══════════════════════════════════════════════════════════════════════
Gốc: `packages/ui/src/index.ts` = `export {};` (RỖNG). `package.json` chỉ khai peer `next/react/react-dom`.
⚠ Không có component nào. Admin khai dep + transpile nhưng KHÔNG import. Component UI của admin nằm rải rác trong
`apps/admin/src/components/**` (chưa được rút lên package dùng chung). → Nên là nơi chứa UI primitives chia sẻ.

═══════════════════════════════════════════════════════════════════════
## 8. LỖI CẤU TRÚC / LOGIC PHÁT HIỆN (để refactor)
═══════════════════════════════════════════════════════════════════════
1. **3 hệ auth song song trong app admin**:
   - DÙNG THẬT: `adminApiClient` + `stores/admin-store.ts` (key `admin_access_token`, `admin-store`).
   - DI SẢN web (gần như chết): `lib/api/api-client.ts` + `auth/auth-provider.tsx` (`AuthProvider` được mount
     trong `AppProviders`!) + `stores/user-store.ts` + `store/authStore.ts`. `AuthProvider` chạy `bootstrap`,
     gọi `/auth/me` qua `apiClient` (web) nếu có `accessToken` trong `user-store` → có thể gây call thừa/nhầm.
   → Nên gỡ toàn bộ nhánh web khỏi admin, hoặc thống nhất 1 store + 1 client.
2. **`AppProviders` của admin mount `AuthProvider` (web)** dù admin xác thực bằng `useAdminStore`.
   Hai nguồn trạng thái auth có thể lệch nhau.
3. **`upload-media.ts` dùng `apiClient` (web)** thay vì `adminApiClient` → upload trong admin có thể KHÔNG
   đính đúng token admin (lấy token từ `user-store`/`localStorage('access_token')`, không phải `admin_access_token`).
4. **Trùng lặp i18n**: `apps/admin/src/i18n.ts` và `packages/shared/src/i18n.ts` định nghĩa cùng thứ.
   `i18n/request.ts` import từ `../i18n` (bản admin), `middleware.ts` import từ `@audio-stories/shared`. 2 nguồn.
5. **`api-client`/`ui` là stub nhưng vẫn là dependency + transpilePackages** → dead config, dễ gây hiểu nhầm.
6. **Guard yếu**: cả middleware (chỉ check cookie tồn tại) lẫn `useRequireAdmin` (chỉ check token/flag tồn tại)
   KHÔNG verify role ở mỗi request. Role ADMIN chỉ check 1 lần lúc login. Bảo mật thật phải nằm ở BE
   (đoán: guard `@Roles('ADMIN')` ở backend — cần đối chiếu docs/02-be-*).
7. **Double-unwrap không nhất quán**: có page đọc `res.data`, có nơi `res.data.data`, có nơi `normalize...()`
   (vd `useAdminLanguages` xử lý cả mảng trần lẫn `{data: [...]}`). Dễ ra `undefined` nếu BE đổi vỏ bọc.
8. **Login phụ thuộc `data.ok`**: `login/page.tsx` chỉ tiếp tục khi `loginRes.data.ok === true`. Nếu BE đổi
   shape (vd bỏ `ok`) thì login "thành công thầm lặng" nhưng nhánh else báo lỗi sai → cần đối chiếu BE.
9. **`store/authStore.ts` `logout()` hard-code `window.location.href='/login'`** (không kèm locale) — lệch
   với luồng locale-prefixed của app. Là di sản, nhưng nếu vô tình dùng sẽ điều hướng sai.
10. **Component web khổng lồ trong admin**: `components/layout/Navbar.tsx` (~66KB),
    `app/[lang]/stories/page.tsx` (~77KB), `interactive-stories/page.tsx` (~64KB),
    `ChapterForm.tsx` (~76KB), `StoryForm.tsx` (~62KB) — quá lớn, khó bảo trì, nên tách nhỏ.

═══════════════════════════════════════════════════════════════════════
## 9. TÌNH TRẠNG & PHẦN CÒN THIẾU
═══════════════════════════════════════════════════════════════════════
- **Admin app**: DONE (chạy được, đầy đủ trang quản trị CRUD theo `navItems`). Còn dọn dẹp di sản web.
- **packages/shared**: DONE (đang dùng thật cho i18n/middleware/auth-const).
- **packages/api-client**: STUB — thiếu axios instance/interceptor/unwrap chia sẻ.
- **packages/ui**: STUB — thiếu toàn bộ component dùng chung.
- THIẾU: lớp type chung cho response BE (mỗi page tự khai interface), chuẩn hoá unwrap, gỡ dead deps,
  thống nhất auth, kiểm thử (e2e admin có thư mục `fe/e2e/admin` — cần đối chiếu độ phủ).

═══════════════════════════════════════════════════════════════════════
## 10. QUY ƯỚC UI ADMIN (cập nhật 2026-06-29)
═══════════════════════════════════════════════════════════════════════
> Các pattern dùng chung vừa thiết lập trong app admin. Đã xác minh lại trong code.

**Upload R2, KHÔNG dùng UploadThing (ở phía admin)**
- Mọi upload đi qua `adminApiClient` (multipart, field `file`), KHÔNG qua `/api/uploadthing/*`:
  - Ảnh → `POST /upload/image`.
  - Audio → `POST /upload/audio` + **thêm field form `folder`** (vd `formData.append('folder', 'chapters')`).
    ⚠ Là FIELD trong multipart body (BE đọc `@Body('folder')`), KHÔNG phải query `?folder=`.
- Đã áp dụng tại:
  - `components/upload/HybridImageUploader.tsx` (ảnh quảng cáo) → `POST /upload/image` qua `adminApiClient`.
  - `app/[lang]/stories/[id]/chapters/_components/ChapterForm.tsx` — thumbnail (`/upload/image`) +
    audio chương (`/upload/audio`, folder `chapters`) qua `adminApiClient`.
  - `app/[lang]/banners/_components/BannerForm.tsx` — ảnh banner (`/upload/image`).
  - `app/[lang]/stories/[id]/chapters/_components/VariantForm.tsx` — audio variant (`/upload/audio`, folder `chapters`).
  - `app/[lang]/stories/_components/StoryForm.tsx` — ảnh truyện (`/upload/image`).
- ⚠ `lib/uploadthing.ts` + route handler `app/api/uploadthing/*` VẪN còn trong repo nhưng KHÔNG được dùng
  cho luồng upload admin nữa (di sản — có thể gỡ sau). `lib/api/upload-media.ts` (`uploadAudioToR2`)
  vẫn dùng `apiClient` (web) — xem cạm bẫy mục 8.3.

**Định dạng số (phân tách nghìn)**
- Util chung: `src/lib/format-number.ts`.
  - `formatThousand(n)` → số nguyên kiểu vi-VN (`Intl.NumberFormat('vi-VN')`, vd `1.000.000`); null/NaN → `''`.
  - `parseThousand(s)` → bỏ mọi ký tự không phải chữ số rồi `Number(...)` (chỉ số nguyên, không phần thập phân).
- Quy ước ô nhập giá/tiền: `type="text"` + `inputMode="numeric"`, `value={formatThousand(...)}`,
  `onChange={parseThousand(...)}`, kèm `onFocus={(e)=>e.target.select()}` (chọn hết khi focus).
- Đã áp: `MusicForm`, `StoryForm`, `packages/page.tsx` (ô `priceVnd` + `pulseAmount`), `users`.

**Định dạng thời lượng**
- < 1h → `mm:ss`; ≥ 1h → `dd:hh:mm:ss` (dùng ở `MusicForm` + danh sách nhạc).

**Form inline (không popup) — có ngoại lệ**
- Form Thêm/Sửa **nhạc, truyện, chương** hiển thị INLINE + auto-scroll (đã bỏ modal overlay).
- ⚠ NGOẠI LỆ: `packages/page.tsx` HIỆN VẪN dùng MODAL overlay (`fixed inset-0 ... backdrop-blur`)
  cho form Thêm/Sửa gói — chưa chuyển sang inline. (Ô giá/pulse đã dùng định dạng phân tách nghìn.)

**Bảng admin (globals.css, scope `body.admin-shell`)**
- Header nền slate-700 chữ trắng; kẻ sọc zebra; hover indigo-50.
- `select.admin-input` có chevron `⌄` vẽ bằng CSS (background-image) — ĐỪNG thêm icon mũi tên thủ công.

**Row-click mở Sửa**
- Click cả dòng → mở form Sửa ở bảng Nhạc / Danh mục / Tác giả.
- Ô checkbox + cụm nút actions trong dòng phải gọi `e.stopPropagation()` để không trigger mở Sửa.

**Quy ước comment `>>>`**
- Các điểm chỉnh kích thước / bố cục được đánh dấu bằng comment chứa chuỗi `>>>` (grep `>>>` để tìm nhanh).
