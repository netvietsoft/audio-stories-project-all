# Reader — Đọc liền mạch & Polish (Spec 1) — Design

> Ngày: 2026-07-08 · App: NovelVerse Flutter · Trạng thái: design đã duyệt, chờ review → plan.
> Đây là **Spec 1** của loạt "Reader sâu hơn". Tách riêng:
> - **Spec 2** (hoãn): Read-along highlight theo audio — cần backend cấp timing (hiện `Chapter` chỉ có `content`/`audioUrl`/`audioDuration`, KHÔNG có transcript/timestamp).
> - **Spec 3** (sau Spec 1): Reader social — comment theo đoạn + theo chương + support(gift) + share, dùng chung API với web (BE `chapter-comments` + `/stories/:id/gift` đã có sẵn; web `StoryReader.tsx` đã triển khai).

## 1. Mục tiêu
Làm màn Reader ([lib/screens/novel/reader_screen.dart](../../../lib/screens/novel/reader_screen.dart)) "sâu hơn" theo 2 nhóm:
- **A. Ghi nhớ & liền mạch:** lưu settings đọc (toàn cục), auto-resume đúng vị trí đang đọc, bookmark vị trí + danh sách, hiển thị % tiến độ.
- **B. Polish:** giữ sáng màn hình, thanh % tiến độ, tap giữa ẩn/hiện chrome (đọc toàn màn hình), chỉnh độ sáng in-app.

Hiện tại các settings đọc, bookmark, vị trí cuộn đều **không được lưu** (reset khi mở lại); bookmark là bool giả; luôn nhảy về đầu chương.

## 2. Phạm vi
**Trong:** persistence (settings/position/bookmark/brightness), auto-resume, bookmark list, progress %, wakelock, tap-center + top-bar trượt, brightness slider. Thuần client.
**Ngoài:** comment/support/share thật (Spec 3); read-along highlight (Spec 2); TTS. Không đụng `AppState`, offline layer, `JsonCache`, `TokenStore`.

## 3. Kiến trúc
Thêm 1 service `ReaderStore` (trên `shared_preferences`), cung cấp qua provider ở `main.dart` như các service khác; `ReaderScreen` đọc/ghi qua nó.

```
main.dart ──provide──► ReaderStore (shared_preferences)
                            ▲
ReaderScreen ──đọc/ghi──────┘
   ├─ nạp settings + brightness khi mở; ghi khi đổi
   ├─ resume: đọc position → chọn chương + jumpTo(offset); ghi position (debounce) khi cuộn
   ├─ bookmark: add/list/remove vị trí; sheet danh sách để nhảy
   ├─ progress %: từ _scroll.position → thanh mỏng + "Ch x/y"
   ├─ chrome: top-bar tự dựng + bottom-nav cùng trượt; tap giữa toggle
   └─ wakelock enable/disable theo vòng đời; brightness slider trong settings sheet
```

**Thành phần:**
- `ReaderStore` (mới) — facade prefs, JSON.
- `ReaderSettings`, `ReaderPosition`, `Bookmark` (mới, data class + toMap/fromMap).
- `ReaderScreen` (sửa) — dùng ReaderStore + thêm resume/bookmark/progress/tap-center/wakelock/brightness; AppBar → top-bar trượt trong Stack.

Nguyên tắc: tách bạch (giống `JsonCache`/`TokenStore`), giữ `AppState` gọn; tái dùng `showUnlockSheet`/`showCommentSheet`/`showGiftSheet` sẵn có.

## 4. Data model + API (`ReaderStore`)
Bọc `shared_preferences`, JSON. Prefs đã nạp sẵn lúc boot → đọc đồng bộ, ghi async.

**Keys & shape:**
- `reader.settings` (toàn cục, áp mọi truyện):
  `ReaderSettings { int bg; int? textColor /*ARGB, null=Auto*/; double fontSize; String font; double lineHeight; String margin }`
- `reader.pos.<bookId>` (1 bản ghi/truyện):
  `ReaderPosition { int chapter; double offset; int savedAt }`
- `reader.bm.<bookId>` (danh sách/truyện):
  `Bookmark { int chapter; double offset; String snippet /*~60 ký tự*/; int savedAt }`
- `reader.brightness` (double 0..1; `-1` = theo hệ thống)

**API:**
```
ReaderSettings readSettings();               Future<void> saveSettings(ReaderSettings s);
ReaderPosition? position(String bookId);     Future<void> savePosition(String bookId, int chapter, double offset);
List<Bookmark> bookmarks(String bookId);     Future<void> addBookmark(String bookId, Bookmark b);
                                             Future<void> removeBookmark(String bookId, int savedAt);
double readBrightness();                     Future<void> saveBrightness(double v);
```
JSON hỏng/thiếu key → trả mặc định (không throw).

## 5. Luồng
### 5.1 Auto-resume
1. `initState`: nạp `readSettings()` → áp ngay (không nháy mặc định).
2. Sau khi `detail` + nội dung chương tải xong: nếu route KHÔNG có `?ch=` → chọn chương từ `position(bookId).chapter`; có `?ch=` thì ưu tiên tham số.
3. `addPostFrameCallback` sau khi chương render → `_scroll.jumpTo(offset.clamp(0, maxScrollExtent))`.

### 5.2 Ghi vị trí
`_onScroll`: debounce ~1s → `savePosition(bookId, _chapter, _scroll.offset)`; ghi thêm khi đổi chương + ở `dispose`. Bổ sung cho `setLastRead` (giữ Home) — `savePosition` giữ offset để resume.

### 5.3 Bookmark
- Nút bookmark top-bar (thật): tap → `addBookmark(bookId, Bookmark(chapter, offset, snippet))`; snippet = ~60 ký tự đoạn gần vị trí cuộn. Icon "đã đánh dấu" nếu vị trí hiện tại ~trùng một bookmark (cùng chương & |offset diff| nhỏ).
- Danh sách bookmark: section trong sheet danh sách chương ("Bookmarks") — dòng `Ch N · snippet · thời gian`; tap → nhảy chương + offset; nút xoá → `removeBookmark(bookId, savedAt)`.

### 5.4 Tiến độ
- Trong chương: `pixels / maxScrollExtent` → % (0–100), qua `ValueListenableBuilder` (không setState toàn màn khi cuộn).
- Thanh mỏng 2–3px ở đáy (trên bottom-nav), màu terracotta trên nền mờ. Nhãn "Ch x/y" thêm vào phụ đề top-bar.

### 5.5 Biên/lỗi
offset > nội dung mới → clamp về max (không crash). Chương đã lưu vị trí nhưng bị khoá → mở panel khoá, bỏ qua offset.

## 6. Polish
- **Wakelock** (`wakelock_plus`): enable ở `initState`, disable ở `dispose`.
- **Tap-center + top-bar trượt:** AppBar → thanh trên tự dựng trong `Stack` (giữ nguyên nút: title/phụ đề, Nghe, Bookmark, Aa, danh sách), `AnimatedSlide` cùng bottom-nav. `GestureDetector(onTap)` vùng giữa → toggle `_chromeVisible` (ẩn/hiện cả trên+dưới). Giữ auto-hide theo cuộn.
- **Brightness** (`screen_brightness`): slider mục BRIGHTNESS trong Reading settings sheet; kéo → `setScreenBrightness(v)` + `saveBrightness(v)`. Mở Reader: `readBrightness()>=0` → áp; `dispose` → `resetScreenBrightness()`. Lỗi/không hỗ trợ → nuốt, không sập.

## 7. Gói mới
`wakelock_plus`, `screen_brightness`.

## 8. File
- Tạo: `lib/data/reader/reader_store.dart`, `lib/data/reader/reader_models.dart` (`ReaderSettings`, `ReaderPosition`, `Bookmark`).
- Sửa: `lib/screens/novel/reader_screen.dart`, `lib/main.dart` (provide ReaderStore), `pubspec.yaml`.

## 9. Testing
- **Unit `ReaderStore`** (deterministic, dùng `SharedPreferences.setMockInitialValues`): settings round-trip; position save/read (bookId chưa có → null); bookmark add→list→remove; brightness save/read; JSON hỏng → mặc định (không throw).
- **`reader_models` round-trip** + thiếu key → default.
- **Thủ công trên máy:** wakelock giữ sáng; brightness slider đổi sáng thật; tap giữa ẩn/hiện; resume nhảy đúng chương+chỗ; bookmark nhảy đúng; thanh % chạy khi cuộn. (Scroll/plugin thiết bị khó unit → verify tay + `flutter analyze` sạch.)

## 10. Ghi chú
- Settings **toàn cục** (không theo từng truyện) — đơn giản, đúng kỳ vọng người đọc.
- `snippet` trong bookmark để nhận diện trong danh sách (không có ảnh/ngữ cảnh khác).
- Spec 3 (social) sẽ cần: web_base prod + định dạng `chapterSlug` cho link share; xác nhận khi làm.
