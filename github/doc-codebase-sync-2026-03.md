# Web Truyen Audio - Codebase Sync Document (As-Is + Next Roadmap)

Version: 2026-03-06
Owner: Internal Engineering
Scope: Backend `be/` + Frontend `fe/` currently in repository

## 1) Muc tieu tai lieu
Tai lieu nay thay the goc nhin "target architecture" bang trang thai code dang chay thuc te (as-is), chi ra chenhlech so voi tai lieu cu, va de xuat huong di tiep theo theo tung buoc uu tien.

## 2) Tom tat nhanh trang thai hien tai
- Backend framework: NestJS 11 + Prisma 6 + MySQL/TiDB.
- Frontend framework: Next.js 16 App Router + Tailwind + Zustand + Axios + React Query provider.
- Auth da co flow JWT/refresh + `/auth/me` + Google callback page.
- Stories da co 5 API public can ban:
  - `GET /stories/home`
  - `GET /stories/categories`
  - `GET /stories/authors`
  - `GET /stories/explore`
  - `GET /stories/:slug`
- Explore da co filter bar tai su dung (category/author/status/sort + apply button).
- Story detail da la layout 2 cot, co custom player controls trong trang chi tiet.
- Da tach Global Player theo huong dung 1 lan trong `(main)/layout.tsx`; audio khong bi ngat khi dieu huong trang.

## 3) Trang thai thuc te theo module

### 3.1 Backend API (as-is)

#### 3.1.1 Route va response shape hien tai
Controller: `be/src/stories/stories.controller.ts`

1. `GET /stories/home`
- Tra ve object truc tiep:
  - `trending: Story[]`
  - `newest: Story[]`
  - `featured: Story[]`
- Khong co wrapper `{ success, data, message }`.
- Khong co section `popular` o endpoint nay.

2. `GET /stories/categories`
- Tra ve danh sach category co `id, name, slug`.

3. `GET /stories/authors`
- Tra ve danh sach author co `id, name`.

4. `GET /stories/explore`
- Query DTO hien tai (`be/src/stories/dto/explore-query.dto.ts`):
  - `page?: number = 1`
  - `limit?: number = 20`
  - `categoryId?: number`
  - `authorId?: string`
  - `status?: ongoing | completed`
  - `sort?: latest | views | title_asc | chapters_desc`
- Response shape:
  - `data: Story[]`
  - `meta: { total, page, lastPage }`

5. `GET /stories/:slug`
- Tra ve story detail kem:
  - author
  - categories
  - chapters (id, title, chapterNumber, content, r2AudioUrl, audioDuration, accessType, unlocksAt)
- Nghia la API nay dang expose truoc ca content va URL audio chapter.

#### 3.1.2 Config/API infra hien tai
- Khong dung global prefix `/api/v1` trong `be/src/main.ts`.
- Co ValidationPipe + CORS whitelist dynamic + cookie-parser.
- AppModule dang load env file `.env` (khong con `.env.dev` trong code hien tai).

### 3.2 Prisma schema (as-is)
Nguon: `be/prisma/schema.prisma`

- Story:
  - `totalViews: BigInt`, `averageRating: Decimal`, `ratingCount`, `isFeatured`, `publishedAt`...
- Chapter:
  - `chapterNumber: Float`
  - `content`, `r2AudioUrl`, `audioDuration`, `accessType: free|timed|vip`, `unlocksAt`
- Author/Category/StoryCategory da co day du.

Luu y chenhlech voi doc cu:
- Doc cu mo ta Chapter `chapterNumber: Int` va field name `type/duration/textContent`; code hien tai dung `chapterNumber: Float`, `accessType/audioDuration/content`.

### 3.3 Frontend kien truc (as-is)

#### 3.3.1 Route hien tai
- Home: `fe/src/app/(main)/page.tsx` -> `/`
- Explore: `fe/src/app/(main)/explore/page.tsx` -> `/explore`
- Story detail: `fe/src/app/(main)/story/[slug]/page.tsx` -> `/story/:slug`
- Auth routes da co login/register/forgot/reset/verify/google callback.
- Co them admin routes theo codebase moi nhat.

Luu y chenhlech voi doc cu:
- Doc cu dung route tieng Viet (`/kham-pha`, `/truyen/[slug]`), code hien tai dang dung route tieng Anh (`/explore`, `/story/[slug]`).

#### 3.3.2 Data client va API client
- Dang ton tai 2 entry import:
  - `fe/src/lib/api/api-client.ts` (file goc)
  - `fe/src/lib/api/apiClient.ts` (re-export)
- Trang Home dang import `@/lib/api/apiClient`, trang Explore/Story import `@/lib/api/api-client`.
- Viec nay chay duoc nhung de gay lech convention va de phat sinh bug import sau nay.

#### 3.3.3 Audio architecture hien tai
- Store audio: `fe/src/stores/audio-store.ts`.
- `GlobalPlayer` da ton tai o: `fe/src/components/player/GlobalPlayer.tsx`.
- Main layout da mount Global Player: `fe/src/app/(main)/layout.tsx`.
- Story detail page da chuyen sang dispatch action store (`playTrack/togglePlay/playNext/playPrev/seekTo`) thay vi tu quan ly `<audio>`.

Ket qua:
- Audio mini player hoat dong toan cuc, giu trang thai khi dieu huong.
- Thumbnail/title tren mini player co the dieu huong lai dung story/chapter dang phat.

### 3.4 Story detail UI da lam xong (as-is)
Trang: `fe/src/app/(main)/story/[slug]/page.tsx`

Da co:
- Layout 2 cot.
- Cot trai:
  - Tieu de + metadata (tac gia/trang thai/ngay cap nhat/views/rating)
  - Nut Tim/Share
  - Gioi thieu
  - Player controls (shuffle/repeat/prev/next/seek +/-10s/play/mute/volume/settings speed + sleep timer)
  - Doc truyen chu
  - Co the ban se thich (3 item)
  - Danh gia va binh luan (placeholder)
- Cot phai:
  - Danh sach chuong + lock/timed labels
  - Top blocks: Trending, Pho bien, Moi dang (5 item moi block)

## 4) Doi chieu voi tai lieu cu (gap analysis)

### 4.1 API contract
1. Prefix API
- Tai lieu cu: `/api/v1/...`
- Code hien tai: khong co prefix, dang la `/stories/...`, `/auth/...`

2. Response envelope
- Tai lieu cu: `{ success, data, message, pagination }`
- Code hien tai: tra truc tiep object domain (`data/meta` tuy endpoint).

3. Home API
- Tai lieu cu: featured/trending/newest/popular + endpoint tach rieng.
- Code hien tai: 1 endpoint `/stories/home` tra `featured/trending/newest`; chua co `popular` trong home response.

4. Explore API
- Tai lieu cu: filter `q`, `categorySlug`, sort `newest|trending|popular|updated`.
- Code hien tai: filter `categoryId`, khong co `q`, sort `latest|views|title_asc|chapters_desc`.

5. Story/Chapter APIs
- Tai lieu cu: tách `GET /stories/:id/chapters`, `GET /chapters/:id`, `GET /chapters/:id/download`, `POST /stories/:id/view`.
- Code hien tai: chua co cac endpoint tren; chapter data nam trong `GET /stories/:slug`.

### 4.2 Frontend architecture
1. GlobalPlayer
- Tai lieu cu: mount 1 lan trong root layout, audio sync thong qua hook.
- Code hien tai: da co GlobalPlayer mount 1 lan trong `(main)/layout.tsx`.

2. Folder/route naming
- Tai lieu cu: mang dinh route `kham-pha/truyen`.
- Code hien tai: route `explore/story`.

3. Hook granularity
- Tai lieu cu: tach nhieu hooks `useHomeData/useExplore/useStoryDetail/useAudioSync`.
- Code hien tai: nhieu logic fetch/player dang co-locate trong page component.

## 5) Ke hoach tiep theo de dong bo kien truc

### Phase 1 - Chot contract API (uu tien cao)
Muc tieu: frontend/backend co contract on dinh, giam "if shape changed".

1. Chon 1 trong 2 huong prefix:
- Huong A: them `app.setGlobalPrefix('api/v1')` + fallback rewrite trong gateway.
- Huong B: giu nguyen khong prefix, cap nhat tai lieu va naming dong bo.

2. Chuan hoa response envelope theo 1 kieu:
- De xuat: `{ data, meta?, message? }`.
- Tranh song song qua nhieu shape.

3. Explore V2:
- Them `q` fulltext/contains.
- Ho tro `categorySlug` song song `categoryId` (de tuong thich UI share link).
- Sort map ro rang (`latest/views/title_asc/chapters_desc` hoac bo sort moi) + docs chot 1 bo duy nhat.

### Phase 2 - Tach Global Audio Player (da hoan thanh)
Trang thai:
1. Da tao `GlobalPlayer` tai `fe/src/components/player/GlobalPlayer.tsx`.
2. Da mount trong `fe/src/app/(main)/layout.tsx`.
3. Story page da bo `<audio>` local, chuyen sang dispatch action store.
4. Da bo sung navigation tu mini player ve chapter dang phat.

Ghi chu ky thuat:
- De tranh hydration mismatch voi Zustand persist, `GlobalPlayer` dung guard `mounted` (chi render sau khi client mount).

### Phase 3 - Story domain APIs day du (uu tien cao hien tai)
1. Them APIs:
- `GET /stories/:id/chapters` (paging)
- `GET /chapters/:id` (detail + access gate)
- `GET /chapters/:id/download` (presigned URL)
- `POST /stories/:id/view` (debounce-safe)
2. Chuyen logic truy cap chapter timed/vip sang backend guard/service.
3. Story detail endpoint chi tra metadata + first page chapter list.

### Phase 4 - Ratings/Comments (uu tien trung binh)
1. API read/write review + pagination.
2. UI form binh luan/rating tai block "Danh gia va binh luan".
3. Recompute `averageRating/ratingCount` theo transaction hoac background job.

### Phase 5 - Refactor frontend maintainability (uu tien trung binh)
1. Chuan hoa import API client ve 1 file duy nhat (`api-client.ts`).
2. Tach typed DTO/interfaces vao folder `types/`.
3. Tach fetch logic ra hooks (`useHomeData/useExplore/useStoryDetail`).
4. Them loading/error states theo component + retry strategy cho audio errors.

## 6) Danh sach viec de doi ten hoac dong bo ngay (quick wins)
1. Thong nhat import API client:
- Thay toan bo `@/lib/api/apiClient` -> `@/lib/api/api-client` (hoac nguoc lai) chi giu 1 convention.

2. Chot route naming business:
- Neu san pham huong nguoi dung VN, can nhac alias route SEO (`/truyen`, `/kham-pha`) map sang route hien tai.

3. Cập nhật docs endpoint cho dung code:
- Bo claims ve endpoint chua ton tai de tranh QA test sai scope.

## 7) Tieu chi done cho dot tiep theo
Sprint tiep theo duoc xem la done khi dat ca 4 dieu kien:
1. Contract API stories duoc freeze trong 1 file docs, FE khong con map shape tam thoi.
2. GlobalPlayer da mount 1 lan, chuyen trang khong ngat audio.
3. Story detail khong con tu giu toan bo logic HTML5 Audio.
4. Block "Danh gia va binh luan" co API va render du lieu that.

## 8) Ket luan
Codebase hien tai da dat muc "MVP+" cho Home/Explore/Story detail va da co Global Player toan cuc.
Do lech lon nhat so voi tai lieu cu hien nay tap trung vao contract API (prefix/response envelope/explore params) va story-chapter domain APIs.
Khuyen nghi tiep theo: uu tien chot API contract + bo sung chapter APIs + comments/ratings theo roadmap.
