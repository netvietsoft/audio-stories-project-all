# Story Rankings — Sub-project C (Admin ranking UIs) — Design

> Ngày: 2026-07-09 · Repo: NovelApp (`be/` NestJS + `fe/apps/admin` Next.js). Loạt "Label + Rankings": A ✅, B1 ✅, B2a ✅, B2b ✅.
> **C** = 3 menu admin tiêu thụ dữ liệu A/B1/B2a/B2b + 1 bổ sung backend nhỏ (trending-per-country) để cả 3 menu đủ 9 metric.
> Trạng thái: design đã được user duyệt (2026-07-09) → chờ review file spec → plan.

## 1. Mục tiêu
Xây 3 màn admin để xem xếp hạng, dùng các endpoint `/stats/*` đã ship:
1. **Top Truyện** — top 100 truyện theo 1 metric (9 lựa chọn); mỗi dòng mở rộng được để xem top-5 quốc gia của truyện đó theo metric đang chọn.
2. **Top Quốc gia** — top 20 quốc gia theo 1 metric.
3. **Xếp hạng theo quốc gia** — chọn 1 quốc gia → top 100 truyện trong quốc gia đó theo 1 metric.

Kèm 1 bổ sung backend: **trending-per-country** để 2 menu geo (Top Quốc gia, Xếp hạng theo quốc gia) và cột top-5-quốc-gia cũng có metric "Xu hướng" (hiện geo chỉ có 8 kind, thiếu trending).

## 2. Phạm vi
**Trong (C):**
- **Backend**: thêm `'trending'` vào `@IsIn` của 3 DTO geo; thêm nhánh `metric==='trending'` trong 3 method service geo (`getTopCountries`, `getTopStoriesByCountry`, `getStoryTopCountries`) tính decay trên `kind='view'`. KHÔNG migration.
- **Frontend admin**: 1 nhóm nav "Bảng xếp hạng" (3 con); 3 trang; 2 component dùng chung (`MetricSwitcher`, `RankingTable`); 1 helper `country-name`.

**Ngoài (C / follow-up):** web/app không đổi (đây là màn admin nội bộ). Bộ lọc ngôn ngữ cho Top Truyện (endpoint có `language` nhưng spec gốc không yêu cầu — bỏ, YAGNI). Các follow-up hạ tầng cũ (trust proxy, geoip update, resolveCountry refactor) vẫn để sau.

## 3. Quyết định đã chốt (brainstorm 2026-07-09)
1. **Cấu trúc menu**: 1 nhóm nav gấp gọn "Bảng xếp hạng" với 3 con (giống nhóm "Quảng cáo"), KHÔNG phải 3 item phẳng.
2. **Cột top-5 quốc gia (Top Truyện)**: **lazy row-expand** — chỉ gọi `story-top-countries` khi bung dòng (mẫu `<details>` của trang vip-stories). KHÔNG thêm batch endpoint. Đây là chi tiết bung ra, không phải cột luôn hiện.
3. **Hiển thị quốc gia**: `Intl.DisplayNames(['vi'], { type: 'region' })` → "VN" hiện "Việt Nam"; fallback về mã gốc nếu không nhận dạng. Dùng cho cả Top Quốc gia và bộ chọn quốc gia ở menu 3.
4. **Trending**: **build trending-per-country** ở backend → cả 3 menu có đủ 9 metric.

## 4. Mô hình 9-metric (nguồn duy nhất điều khiển cả 3 trang)
Một bảng ánh xạ mỗi metric UI sang tham số endpoint đúng:

| key (UI) | nhãn | `/stats/top-stories` metric | geo `kind` (3 endpoint geo) |
|---|---|---|---|
| `reads` | Đọc nhiều | `reads` | `view` |
| `rating` | Đánh giá | `rating` | `rating` |
| `comments` | Bình luận | `comments` | `comment` |
| `favorites` | Yêu thích | `favorites` | `favorite` |
| `gifts` | Tặng quà | `gifts` | `gift` |
| `trending` | Xu hướng | `trending` | `trending` (mới) |
| `search` | Tìm kiếm | `search` | `search` |
| `revenue` | Doanh thu | `revenue` | `revenue` |
| `audio` | Nghe audio | `audio` | `listen` |

- Top Truyện dùng cột `top-stories`; 2 menu geo + cột top-5 dùng cột `geo kind`.
- Đặt bảng này ở 1 nơi (vd `src/lib/ranking-metrics.ts`) để 3 trang + MetricSwitcher import chung. Thứ tự metric trong bảng = thứ tự hiển thị.

## 5. Endpoint tiêu thụ (đã ship, xác nhận từ code)
| Endpoint | Query | Response |
|---|---|---|
| `GET /stats/top-stories` | `metric=<9>&limit=100` (bỏ `language`) | `{ data: [{ rank, storyId, title, slug, thumbnailUrl, value }] }` |
| `GET /stats/top-countries` | `metric=<geoKind>&limit=20` | `{ data: [{ rank, country, value }] }` |
| `GET /stats/top-stories-by-country` | `country=XX&metric=<geoKind>&limit=100` | `{ data: [{ rank, storyId, title, slug, thumbnailUrl, value }] }` |
| `GET /stats/story-top-countries` | `storyId=&metric=<geoKind>&limit=5` | `{ data: [{ country, value }] }` |

- Tất cả admin-guarded (`JwtAccessGuard` + `RolesGuard` + `@Roles('ADMIN')`). Gọi qua `adminApiClient` (không unwrap ở interceptor → `res.data` = body BE `{ data, meta? }`). Dùng `unwrapList` để lấy mảng an toàn mọi độ bọc.
- `value` là số (BigInt đã `Number()` ở BE); FE format `toLocaleString('vi-VN')`. Với `rating`/`trending` `value` là số thực → hiển thị làm tròn (rating 2 chữ số thập phân; trending làm tròn nguyên hoặc 1 chữ số).

## 6. Backend — trending-per-country
Tất cả nhánh mirror biểu thức decay của global-trending trong `getTopStoriesAggregated`:
`SUM(count * POW(0.9, DATEDIFF(UTC_DATE(), date)))` trên `kind='view'`, `date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY)`.

**6.1 DTO** — thêm `'trending'` vào `@IsIn([...])` (và union type) của 3 file:
- `be/src/stats/dto/top-countries-query.dto.ts`
- `be/src/stats/dto/stories-by-country-query.dto.ts`
- `be/src/stats/dto/story-top-countries-query.dto.ts`

**6.2 `getTopCountries`** — khi `metric==='trending'`:
```
SELECT country, SUM(count * POW(0.9, DATEDIFF(UTC_DATE(), date))) AS value
FROM story_country_daily
WHERE kind = 'view' AND date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY)
GROUP BY country ORDER BY value DESC LIMIT ${limit}
```
Ngược lại giữ nguyên `SUM(count) WHERE kind = ${metric}`.

**6.3 `getTopStoriesByCountry`** — khi `metric==='trending'`:
```
SELECT scd.story_id AS id, SUM(scd.count * POW(0.9, DATEDIFF(UTC_DATE(), scd.date))) AS value
FROM story_country_daily scd JOIN stories s ON s.id = scd.story_id
WHERE scd.kind = 'view' AND scd.country = ${country}
  AND scd.date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY) AND s.deleted_at IS NULL
GROUP BY scd.story_id ORDER BY value DESC LIMIT ${limit}
```
Ngược lại giữ nguyên nhánh cũ. Phần hydrate story (findMany + Map, order-preserving) không đổi.

**6.4 `getStoryTopCountries`** — khi `metric==='trending'`:
```
SELECT country, SUM(count * POW(0.9, DATEDIFF(UTC_DATE(), date))) AS value
FROM story_country_daily
WHERE story_id = ${storyId} AND kind = 'view' AND date >= DATE_SUB(UTC_DATE(), INTERVAL 29 DAY)
GROUP BY country ORDER BY value DESC LIMIT ${limit}
```
Ngược lại giữ nguyên nhánh cũ (`kind = ${metric}`).

- Ngữ nghĩa: geo-trending dùng lượt view có-quốc-gia (subset IP giải được), nhất quán với cách geo chỉ đếm traffic giải được (global trending dùng `story_view_daily` = toàn bộ view — khác nguồn, chấp nhận, giống các metric geo khác).

## 7. Frontend — nav + trang + component
### 7.1 Nav (`fe/apps/admin/src/components/admin/AdminShellLayout.tsx`)
Thêm 1 `NavGroup` vào mảng `navItems` (đặt sau "Thống kê Truyện VIP" hoặc gần các mục thống kê), icon `BarChart3` (import từ `lucide-react`):
```
{
  label: 'Bảng xếp hạng',
  icon: BarChart3,
  children: [
    { href: '/rankings/top-stories', label: 'Top Truyện', icon: Newspaper },
    { href: '/rankings/top-countries', label: 'Top Quốc gia', icon: Globe2 },
    { href: '/rankings/by-country', label: 'Xếp hạng theo quốc gia', icon: Globe2 },
  ],
}
```
Cơ chế group/active/collapse đã có sẵn — chỉ thêm dữ liệu.

### 7.2 Helper `src/lib/country-name.ts`
```
const dn = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['vi'], { type: 'region' }) : null;
export function countryName(code: string): string {
  if (!code) return '';
  try { return dn?.of(code.toUpperCase()) ?? code.toUpperCase(); }
  catch { return code.toUpperCase(); }
}
```
(khởi tạo `Intl.DisplayNames` 1 lần ở module scope; try/catch cho mã lạ.)

### 7.3 `src/lib/ranking-metrics.ts`
Xuất mảng `RANKING_METRICS` gồm 9 phần tử `{ key, label, storyMetric, geoKind }` theo bảng §4, + type `RankingMetricKey`. Thứ tự = thứ tự hiển thị (reads đầu tiên = mặc định).

### 7.4 Component dùng chung (đặt tại `src/app/[lang]/rankings/_components/`)
- **`MetricSwitcher.tsx`**: nhận `value: RankingMetricKey` + `onChange`; render hàng "pill" bấm chọn (hoặc `<select>`) 9 metric từ `RANKING_METRICS`. Dùng cho cả 3 trang.
- **`RankingTable.tsx`**: bảng dòng xếp hạng dùng chung cho truyện. Props:
  `rows: { rank; storyId; title; slug; thumbnailUrl; value }[]`, `metricLabel: string`, `formatValue: (v:number)=>string`, và optional `renderExpand?: (storyId:string) => ReactNode` (nếu có → mỗi dòng bọc `<details>` bung phần mở rộng). Style card/pink giống vip-stories.

### 7.5 Trang 1 — Top Truyện (`src/app/[lang]/rankings/top-stories/page.tsx`)
- State: `metric` (mặc định `reads`), `rows`, `loading`, và `expanded: Record<storyId, {loading; countries: {country;value}[]}>`.
- `useEffect([metric])`: `apiClient.get('/stats/top-stories?metric=' + storyMetric + '&limit=100')` → `unwrapList` → `rows`.
- Bung dòng: khi mở `<details>` của 1 truyện lần đầu → gọi `/stats/story-top-countries?storyId=&metric=' + geoKind + '&limit=5` → lưu vào `expanded[storyId]`; lần sau dùng cache. Đổi metric → reset cache expanded. Lỗi fetch → hiển thị "—" (không chặn).
- Hiển thị: rank, thumbnail, title, `value` (format theo metric). Phần bung: danh sách top-5 quốc gia (`countryName(country)` + value) hoặc "Chưa có dữ liệu quốc gia".

### 7.6 Trang 2 — Top Quốc gia (`src/app/[lang]/rankings/top-countries/page.tsx`)
- State: `metric` (mặc định `reads`→geoKind `view`), `rows`, `loading`.
- `useEffect([metric])`: `apiClient.get('/stats/top-countries?metric=' + geoKind + '&limit=20')` → `unwrapList`.
- Bảng: rank + tên quốc gia (`countryName`, kèm mã ISO nhỏ) + value. (Không dùng RankingTable-truyện; bảng quốc gia riêng, đơn giản.)

### 7.7 Trang 3 — Xếp hạng theo quốc gia (`src/app/[lang]/rankings/by-country/page.tsx`)
- State: `country` (mặc định null), `countryOptions: {code;name}[]`, `metric`, `rows`, `loading`.
- Nạp danh sách quốc gia 1 lần: `apiClient.get('/stats/top-countries?metric=view&limit=100')` → map `{ code: country, name: countryName(country) }`, sort theo name (vi). Mặc định chọn quốc gia đầu (nhiều view nhất).
- `useEffect([country, metric])` (khi có `country`): `apiClient.get('/stats/top-stories-by-country?country=' + country + '&metric=' + geoKind + '&limit=100')` → `unwrapList` → `rows`. Dùng `RankingTable` (không truyền `renderExpand`).
- Bộ chọn quốc gia: `<select>` (style giống các select ở vip-stories).

## 8. Data flow (tóm tắt)
```
MetricSwitcher(metric) --+--> Top Truyện: top-stories?metric=storyMetric
                         |        └─(expand)→ story-top-countries?storyId&metric=geoKind
                         +--> Top Quốc gia: top-countries?metric=geoKind
                         +--> By-country(country + metric): top-stories-by-country?country&metric=geoKind
country picker <-- top-countries?metric=view (danh sách quốc gia có dữ liệu)
countryName(code) <-- Intl.DisplayNames (hiển thị mọi nơi có mã quốc gia)
```

## 9. Lỗi & biên
- Endpoint lỗi/empty → state loading + "Không có dữ liệu" (mẫu vip-stories).
- Bung dòng lỗi → "—"/"Chưa có dữ liệu quốc gia", không chặn UI (fire-and-forget).
- `Intl.DisplayNames` không nhận mã → fallback mã in hoa.
- Chưa chọn quốc gia (menu 3) → hiện gợi ý "Chọn một quốc gia".
- Metric có `value` thực (rating/trending) → format số thực; các metric đếm → số nguyên `toLocaleString`.
- Quốc gia rỗng (dev DB ít dữ liệu geo) → danh sách chọn có thể trống → hiện "Chưa có dữ liệu quốc gia nào".

## 10. Testing
- **Backend (jest, `node node_modules/jest/bin/jest.js be/src/stats/geo-rankings.spec.ts`)**: 3 nhánh trending — mock/`$queryRaw` gọi đúng (decay expr, `kind='view'`, cửa sổ 29 ngày); DTO chấp nhận `metric='trending'` (và vẫn nhận 8 kind cũ). Live smoke: chạy 3 endpoint geo `metric=trending` trên dev DB → SQL execute không lỗi (0 dòng cũng OK).
- **Frontend**: `tsc --noEmit` (typecheck admin app); thủ công: đổi metric ở cả 3 trang, bung dòng Top Truyện xem top-5, đổi quốc gia ở menu 3, kiểm tên quốc gia hiển thị tiếng Việt.

## 11. File dự kiến
- **BE sửa**: `be/src/stats/dto/{top-countries-query,stories-by-country-query,story-top-countries-query}.dto.ts` (+`'trending'`); `be/src/stats/stats.service.ts` (3 nhánh trending); `be/src/stats/geo-rankings.spec.ts` (test trending).
- **FE mới**: `fe/apps/admin/src/lib/country-name.ts`; `fe/apps/admin/src/lib/ranking-metrics.ts`; `fe/apps/admin/src/app/[lang]/rankings/_components/MetricSwitcher.tsx`; `.../_components/RankingTable.tsx`; `.../rankings/top-stories/page.tsx`; `.../rankings/top-countries/page.tsx`; `.../rankings/by-country/page.tsx`.
- **FE sửa**: `fe/apps/admin/src/components/admin/AdminShellLayout.tsx` (thêm nhóm nav "Bảng xếp hạng").

## 12. Ghi chú / follow-up
- Không migration mới cho C. (Các migration A/B1/B2a vẫn cần deploy prod: `labels`+`stories.label_id`, `story_view_daily`, `story_country_daily`.)
- Có thể thêm bộ lọc ngôn ngữ cho Top Truyện sau (endpoint đã hỗ trợ `language`).
- `story-top-countries` DTO `@Max(50)` (thay vì `@Max(100)`) — follow-up nhỏ cũ, không bắt buộc trong C.
