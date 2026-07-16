# Reader — Bình luận theo đoạn + chương (full replies/reactions) — Design

> Ngày: 2026-07-15 · App: NovelVerse Flutter (BE `api.dreamtap.me` ĐÃ CÓ đủ API — module `chapter-comments` của backend-port, không sửa BE) · Trạng thái: design đã duyệt, chờ review → plan.
> Scope v1 (user chốt): xem + viết comment cấp ĐOẠN và cấp CHƯƠNG, kèm **replies lồng + reactions**. UX bubble (user chốt): count chỉ hiện khi đoạn có comment; **long-press** đoạn để viết comment đầu tiên.

## 1. API BE dùng (đối chiếu `backend-port/be/src/chapter-comments/*`)

| Endpoint | Auth | Ghi chú |
|---|---|---|
| `GET /chapters/:chapterId/comments` | public | Query: `scope` (`chapter`\|`paragraph`), `paragraphIndex`, `allParagraphs` (true → trả TẤT CẢ, bỏ phân trang), `page`, `limit` (max 100), `sort` (`newest`\|`helpful`\|`all`). Chỉ trả comment gốc (`parentId=null`, `isHidden=false`) + meta phân trang. |
| `GET /comments/:commentId/replies` | public | `page`, `limit`. |
| `POST /chapters/:chapterId/comments` | **Bearer** | Body: `{content(≤5000), parentId?, scope?, paragraphIndex?, paragraphAnchor?(≤120)}`. |
| `POST /comments/:commentId/reactions` | **Bearer** | Body `{type: 'helpful'\|'like'\|'love'}` — TOGGLE (gửi lại là bỏ). |
| `POST /comments/:commentId/report` | **Bearer** | `{reason}` — v1 đặt trong menu "…" của comment. |

**Shape comment (serializeComment BE):** `{id, content, createdAt, likesCount, paragraphIndex, paragraphAnchor|null, user{id, displayName, avatarUrl|null}, reactions{helpful,like,love: int}, repliesCount}`.
KHÔNG có field "myReaction" — app không biết mình đã react gì; v1 chấp nhận: bấm reaction gọi toggle rồi refetch/điều chỉnh count cục bộ (optimistic ±1, không highlight trạng thái "đã react").
KHÔNG dùng `GET /chapters/:id/comments/counts` — nó đếm theo `paragraphIndex` thuần, lệch với comment tạo từ web (web tách đoạn khác app). Thay bằng load `scope=paragraph&allParagraphs=true` rồi group phía app.

## 2. Neo đoạn (anchor) — mấu chốt tương thích app ↔ web

Thuật toán anchor **port nguyên văn** từ web/backfill (`be/prisma/backfill-paragraph-anchor.ts` — "byte-identical to FE"):

```
normFull(s) = s.replace(/<[^>]*>/g,' ')                       // strip tag
              .replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g,' ') // strip entity
              .replace(/[^\p{L}\p{N}]+/gu, ' ')                // không phải chữ/số (Unicode) → space
              .trim().toLowerCase()
makeAnchor(s) = normFull(s).slice(0, 100)
```

Dart: `RegExp(r'[^\p{L}\p{N}]+', unicode: true)` giữ dấu tiếng Việt đúng như JS `\p{L}`.

- **Khi ĐĂNG comment đoạn**: app gửi `paragraphIndex` = index đoạn theo cách tách của app (split `\n\s*\n`, trim, bỏ rỗng — trùng thứ tự render) + `paragraphAnchor = makeAnchor(đoạn gốc đã trim, TRƯỚC flattenHardBreaks)`. (flatten thay `\n`→space 1:1; normFull coi `\n` lẫn space đều là separator → anchor TRƯỚC hay SAU flatten cho cùng kết quả — chọn "trước" cho rõ định nghĩa.)
- **Khi HIỂN THỊ**: group mọi comment đoạn vào đoạn app bằng `matchCommentToParagraph`:
  1. Anchor 2 chiều: comment map vào đoạn app ĐẦU TIÊN có `a.startsWith(p) || p.startsWith(a)` (a=anchor comment, p=makeAnchor(đoạn); cả hai không rỗng) — vì web gộp đoạn ≥250 từ nên anchor web có thể dài hơn/ngắn hơn anchor đoạn app.
  2. Fallback khi anchor null/không match: dùng `paragraphIndex.clamp(0, số đoạn - 1)`.
- Hàm thuần, test được: `Map<int, List<ChapterComment>> matchCommentsToParagraphs(List<ChapterComment>, List<String> paras)`.

## 3. Tầng data

**File mới `lib/data/repositories/comments_repository.dart`** (+ endpoints vào `api_endpoints.dart`, provider vào `main.dart` cạnh các repo khác):
- Model `ChapterComment` (fields theo §1; `fromJson` tolerant kiểu num/string như mapper hiện có) + `CommentPage {items, page, lastPage, total}` (đọc meta qua `unwrapList`/`unwrapMeta`, gọi `raw:true` như explore).
- `paragraphAll(chapterId)` → `scope=paragraph&allParagraphs=true` → `List<ChapterComment>`.
- `chapterPage(chapterId, {page, sort})` → `scope=chapter` → `CommentPage`.
- `replies(commentId, {page})` → `CommentPage`.
- `create(chapterId, {content, parentId, scope, paragraphIndex, paragraphAnchor})` → `ChapterComment` (BE trả comment vừa tạo).
- `toggleReaction(commentId, String type)` — BE toggle xong trả `reactions{helpful,like,love}` MỚI (đã đối chiếu service) → app cập nhật count từ response, không cần optimistic mù.
- `report(commentId, reason)`.

**File mới `lib/data/comments/paragraph_anchor.dart`**: `makeAnchor`, `matchCommentsToParagraphs` (thuần Dart, không import Flutter).

## 4. UI

**Bubble trong Reader** (`reader_screen.dart`):
- State: `Map<int, List<ChapterComment>> _paraComments` — load sau `_loadContent` khi ONLINE (fire-and-forget, lỗi → rỗng, không chặn đọc); reload khi đổi chương. Đọc OFFLINE/local-first → không load, bubble ẩn.
- Dưới đoạn có comment: hàng căn PHẢI `Icon(Icons.mode_comment_outlined, 14) + '3'` màu `pal.muted` — bấm mở sheet đoạn. KHÔNG hiện gì ở đoạn 0 comment.
- **Long-press** đoạn văn (GestureDetector bọc đoạn — không phá tap-center toggle chrome hiện có) → mở sheet đoạn đó (kể cả rỗng) để viết.

**Sheet dùng chung — file mới `lib/screens/novel/widgets/comments_sheet.dart`** (reader_screen ~950 dòng, không nhét thêm):
- `showChapterCommentsSheet(context, {chapterId, scope, paragraphIndex?, paragraphAnchor?, initialComments?})` — modal bottom sheet 85% như sheet Aa.
- Header: "Bình luận" + count + (scope chapter) segment sort **Mới nhất / Hữu ích**.
- List: avatar (CircleAvatar từ `avatarUrl`, fallback chữ cái đầu) · displayName · thời gian tương đối · content · hàng action: 3 reaction `👍 like · ❤️ love · ⭐ helpful` (count, bấm toggle → optimistic ±1) · "Trả lời" · nếu `repliesCount>0` nút "Xem N trả lời" → expand gọi `replies()` (indent 1 cấp, không lồng sâu hơn) · menu "…" → Báo cáo.
- Scope chapter: infinite scroll theo `CommentPage` (pattern CategoryStoriesScreen). Scope đoạn: list từ `initialComments` (đã group) — không phân trang.
- Ô nhập đáy: TextField + nút gửi; đang reply → chip "Trả lời @Tên ✕". Gửi xong: prepend vào list (hoặc vào replies của parent) + callback cho Reader cập nhật `_paraComments` (bubble count).
- **Auth gate**: bấm gửi/reaction/report khi `AppState` chưa đăng nhập → đóng sheet, `context.push('/login')` (giữ đơn giản v1; không auto-quay-lại).

**Cuối chương**: nút Comment ở End-of-Chapter đổi từ `showCommentSheet` (demo) sang sheet mới scope=chapter. Đã kiểm tra: `showCommentSheet` chỉ còn ĐÚNG 1 call-site (reader_screen.dart:664) → **xoá hàm demo** khỏi `lib/widgets/sheets.dart` + cập nhật dòng mô tả trong `lib/widgets/README.md` (orphan do thay đổi này tạo ra).

## 5. Ngoài phạm vi v1

- Trạng thái "tôi đã react" (BE không trả myReaction) — hiển thị highlight sau khi BE bổ sung.
- Sửa/xoá comment của mình; đăng comment khi offline (queue).
- Realtime/polling cập nhật comment mới.
- Comment trên web-style merge đoạn ≥250 từ phía app (app giữ cách tách của mình, anchor lo phần tương thích).

## 6. Test

- `makeAnchor`: tiếng Việt có dấu giữ nguyên chữ, dấu câu/xuống dòng → space đơn, entity `&nbsp;`/`&#39;` bị loại, cắt đúng 100 ký tự.
- `matchCommentsToParagraphs`: match anchor chuẩn; anchor web dài hơn (chunk gộp) vẫn match đoạn đầu chunk; anchor null → fallback index; index vượt range → clamp.
- `CommentsRepository`: fake ApiClient — đúng path/query từng method; parse shape §1 (kể cả `paragraphAnchor` null, `reactions` thiếu key); `create` gửi đủ body.
- `flutter analyze` 0 lỗi/0 cảnh báo; full `flutter test` pass. UI verify trên máy A50s (bubble, long-press, sheet, reply, reaction).

## 7. Quyết định đã chốt (2026-07-15)

1. Scope v1 full: đoạn + chương, xem + viết + replies + reactions (user chọn).
2. Bubble count chỉ khi có comment; long-press để viết (user chọn).
3. Bỏ `/counts`, group bằng anchor phía app (anchor-first, index-fallback).
4. Optimistic reaction không trạng thái cá nhân (BE chưa trả myReaction).
5. Sheet tách file riêng; auth gate đẩy `/login`.
