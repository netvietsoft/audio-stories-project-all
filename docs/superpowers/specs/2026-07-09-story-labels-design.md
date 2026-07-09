# Story Labels (Hot/New/Editor's Choice…) — Design

> Ngày: 2026-07-09 · Repo: NovelApp backend (NestJS `be/` + admin Next.js `fe/apps/admin`) + app `novelverse` (Flutter) + web `fe/apps/web`.
> Sub-project **A** của loạt "Label + Bảng xếp hạng". **B** (metrics + geo-IP) và **C** (các menu Top) tách riêng, làm sau (A → B → C).
> Trạng thái: design chờ user duyệt → plan.

## 1. Mục tiêu
Admin quản lý được một tập **label** (Hot / New / Editor's Choice / …): thêm/sửa/xoá. Mỗi label có **vòng đời tính bằng ngày** (mặc định theo label, có thể override khi gán). Trong trang sửa truyện (admin), gán **một** label cho truyện. Label thay thế hoàn toàn badge tự-suy-diễn cũ trên bìa (app + web).

## 2. Phạm vi
**Trong (A):**
- BE: model `Label` + CRUD (`/labels`, admin-guarded) mirror module `categories`. Gán label vào truyện qua story create/update. Serve label đang hiệu lực trong serialize story (thay `computeBadge`). Seed 3 label mặc định.
- Admin: menu **"Quản lý Label"** (`/labels`) list + modal thêm/sửa/xoá (clone trang Categories). Chọn label (single-select) + ô "số ngày override" trong mục **"Phân loại"** của form truyện.
- App (Flutter) + Web: widget badge trên bìa render theo label `{text, color, icon}` thay cho 4 mã cứng cũ.

**Ngoài (B/C hoặc follow-up):**
- Bảng xếp hạng Top Truyện / Top Quốc gia / Xếp hạng theo quốc gia (sub-project C).
- Metrics 9 loại + gán quốc gia theo IP (sub-project B).
- Nhiều label / truyện (v1 chỉ **1 label**). Auto gán "New" khi publish (follow-up). Job dọn label hết hạn (không bắt buộc — hết hạn tính lúc đọc).

## 3. Quyết định đã chốt (brainstorm 2026-07-09)
1. **Vòng đời**: label có `defaultDurationDays`; khi gán vào truyện có thể **override** số ngày cho lần gán đó. `null`/`0` = không hết hạn.
2. **Bội số**: **1 label / truyện** tại một thời điểm (gán label mới thay label cũ; có tuỳ chọn "bỏ label").
3. **Badge cũ**: label **thay thế hoàn toàn** logic suy diễn NEW/HOT/TOP/VIP. Truyện chưa gán label → không có badge.
4. **Chữ label**: 1 chuỗi hiển thị chung (không đa ngôn ngữ) + màu (+ icon tuỳ chọn).
5. **Phạm vi**: full vertical slice (BE + admin + app + web).

## 4. Data model
**Model mới `Label`** (`be/prisma/schema.prisma`):
```
model Label {
  id                 Int      @id @default(autoincrement())
  name               String   @unique          // tên admin nội bộ, vd "Hot"
  text               String                    // chữ hiển thị trên badge, vd "HOT"
  color              String                    // màu nền badge, hex vd "#E4572E"
  textColor          String?                   // màu chữ (mặc định trắng nếu null)
  icon               String?                   // tuỳ chọn: tên icon / emoji
  defaultDurationDays Int?                     // null/0 = không hết hạn
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  stories            Story[]                   // back-relation
}
```
**Thêm vào `model Story`:**
```
  labelId        Int?
  label          Label?    @relation(fields: [labelId], references: [id], onDelete: SetNull)
  labelAssignedAt DateTime?
  labelExpiresAt  DateTime?                    // null = không hết hạn
```
**Migration**: `add_story_labels` — tạo bảng `labels` + thêm cột `label_id`/`label_assigned_at`/`label_expires_at` vào `stories` (+ FK, index `label_id`). ⚠ Repo `.gitignore` chặn `*.sql` → **prod phải `prisma migrate deploy`** (giống read-along). Map tên cột snake_case (`@map`) theo quy ước schema hiện tại.

**Nhãn "đang hiệu lực"** (tính lúc đọc, không cần cron):
`activeLabel = labelId != null && (labelExpiresAt == null || now < labelExpiresAt) ? label : null`.

## 5. Backend (`be/src/labels/`, mirror `be/src/categories/`)
- `labels.controller.ts` `@Controller('labels')`:
  - `GET /labels` (public, cache như categories) — list (page/limit/search).
  - `GET /labels/:id` (public).
  - `POST /labels` (JwtAccessGuard+RolesGuard, `@Roles('ADMIN')`) — {name, text, color, textColor?, icon?, defaultDurationDays?}.
  - `PATCH /labels/:id`, `DELETE /labels/:id`, `DELETE /labels/bulk/delete` (admin).
- `labels.service.ts` Prisma CRUD (`prisma.label.*`), trả `{data, meta}`; `handlePrismaError`.
- DTO: `create-label.dto.ts` (name, text, color required; textColor/icon/defaultDurationDays optional, `class-validator`), `update-label.dto.ts` (all optional), `label-query.dto.ts` (page/limit/search).
- `labels.module.ts` + đăng ký trong app module.
- **Gán vào truyện** (`stories.service.ts` + story DTO):
  - `create-story.dto.ts` / `update-story.dto.ts`: thêm `labelId?: number | null`, `labelDurationDaysOverride?: number | null`.
  - `create()` / `update()`: khi payload có `labelId`:
    - `labelId = null` → clear: set `labelId=null, labelAssignedAt=null, labelExpiresAt=null`.
    - `labelId` hợp lệ → `labelAssignedAt=now`; `days = labelDurationDaysOverride ?? label.defaultDurationDays`; `labelExpiresAt = (days && days>0) ? addDays(now, days) : null`.
  - Nếu payload **không** có `labelId` (undefined) → giữ nguyên (không đụng).
- **Serialize** (`serializeStory`): **bỏ `computeBadge`**; thêm `label` (object|null) từ activeLabel:
  `label: active ? { id, name, text, color, textColor, icon } : null`. `select` story ở các endpoint (home/detail/list) thêm quan hệ `label` + cột `labelId/labelExpiresAt`.
- **Seed** 3 label mặc định (Hot, New, Editor's Choice) với màu + `defaultDurationDays` gợi ý (New=14, Hot=7, Editor's Choice=null/không hết hạn) — qua seed script hiện có hoặc migration data.

## 6. Admin (`fe/apps/admin`)
- **Sidebar** (`src/components/admin/AdminShellLayout.tsx`): thêm leaf `{ href: '/labels', label: 'Quản lý Label', icon: Tag }` ngay sau `/categories`.
- **Trang `/labels`** (`src/app/[lang]/labels/page.tsx` + `_components/LabelForm.tsx`): clone trang Categories — list (search, phân trang, xoá đơn/bulk) + modal thêm/sửa. Form fields: name, text (chữ badge), color (color picker/hex), textColor?, icon?, defaultDurationDays. Preview badge nhỏ (text + màu) trong form. Gọi `apiClient` `/labels`.
- **Form truyện** (`src/app/[lang]/stories/_components/StoryForm.tsx`, mục **"Phân loại"**): thêm **single-select** Label (dropdown, load `GET /labels`; có tuỳ chọn "— Không label —") + ô số "Số ngày gim (override, để trống = mặc định label)". Gửi `labelId` (number|null) + `labelDurationDaysOverride?` trong payload create/update.

## 7. App (Flutter `novelverse`) + Web (`fe/apps/web`)
- Story model/mapper: đổi trường `badge` (string) → `label` object `{text, color, icon}|null` (map từ API `label`).
- Widget badge trên bìa (app: widget đang render `story.badge`; web: StoryCard badge): render `label.text` với nền `label.color` (+ icon nếu có); không có label → ẩn.
- Bỏ mọi chỗ client tự map/localize 4 mã NEW/HOT/TOP/VIP.
- Plan phải **định vị chính xác** file widget badge ở app + web (recon chưa quét) trước khi sửa.

## 8. Lỗi & biên
- Xoá 1 label đang gán cho truyện → `onDelete: SetNull` (truyện mất label, không lỗi).
- Label hết hạn → activeLabel = null (tính lúc đọc), badge tự ẩn; cột `labelId` vẫn còn (job dọn = follow-up).
- `defaultDurationDays` null/0 → không hết hạn.
- override rỗng → dùng defaultDurationDays.
- name trùng → 409 (unique), báo lỗi form.

## 9. Testing
- **BE unit**: labels.service CRUD; assign logic (set/clear/override/expiry tính đúng addDays); serializeStory trả `label` đúng cho 3 case (active / hết hạn / không gán) và **không** còn NEW/HOT/TOP/VIP.
- **Admin**: tsc sạch; smoke tạo/sửa/xoá label + gán vào truyện.
- **App**: unit map `label` từ JSON; analyze 0 error/warning.
- **Thủ công**: tạo label → gán truyện (mặc định + override) → thấy badge trên app/web; hết hạn → badge ẩn; xoá label → truyện mất badge.

## 10. File dự kiến
**BE**: `be/prisma/schema.prisma` (+migration); `be/src/labels/*` (controller/service/module + dto); `be/src/stories/{stories.service.ts, dto/create-story.dto.ts, dto/update-story.dto.ts}`; seed.
**Admin**: `AdminShellLayout.tsx`; `app/[lang]/labels/{page.tsx,_components/LabelForm.tsx}`; `app/[lang]/stories/_components/StoryForm.tsx`.
**App**: story model/mapper + badge widget (`novelverse/lib/...`).
**Web**: StoryCard/badge (`fe/apps/web/...`).

## 11. Ghi chú / follow-up
- Auto gán "New" khi publish (thay hành vi ≤30 ngày cũ) — follow-up nếu cần.
- Job dọn label hết hạn (null hoá labelId) — không bắt buộc.
- Nhiều label/truyện — nếu sau này cần, đổi sang bảng join `StoryLabel` (giống StoryCategory).
- B (metrics + geo-IP) và C (menu Top) là các cycle riêng.
