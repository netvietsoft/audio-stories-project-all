# 05 — Component & token dùng chung (NovelVerse Flutter)

> Theme token (`theme/`) + widget tái dùng (`widgets/`). Dựa trên code thật. Cập nhật: 2026-07-02.

═══════════════════════════════════════════════════════════════════════
## 1. TOKEN MÀU — `AppPalette` (`theme/app_palette.dart`)
═══════════════════════════════════════════════════════════════════════

`AppPalette extends ThemeExtension<AppPalette>` — gắn vào `ThemeData.extensions`,
truy cập qua **`context.pal`**.

```dart
final pal = context.pal;
Container(color: pal.card, child: Text('x', style: TextStyle(color: pal.ink)));
```

- **Token theo theme** (đổi sáng/tối): `bg, bg2, card, ink, soft, muted, line, line2,
  surf, surf2, accentSurf, plumSurf, sageSurf, amber, sage`. Có sẵn `AppPalette.light`
  và `AppPalette.dark` (giá trị khớp `../handoff/01-design-system.md`).
- **Brand cố định** (KHÔNG đổi theo theme, dùng trực tiếp `AppPalette.x`): `terracotta`
  (CTA Novel), `terracottaDark`, `plum` (Audio), `coinA/coinB` (gradient coin),
  `rank1/rank2/rank3` (hạng #1/#2/#3).

> Quy ước: màu phụ thuộc nền (chữ, viền, surface) → `context.pal.*`. Màu thương hiệu
> (accent, coin, rank) → `AppPalette.*`. **Đừng** viết `Color(0xFF...)` rời trong màn
> trừ trường hợp gradient đặc thù.

═══════════════════════════════════════════════════════════════════════
## 2. TOKEN CHỮ — `AppType` (`theme/app_type.dart`)
═══════════════════════════════════════════════════════════════════════

2 họ font (Google Fonts): **Spectral** (serif, tiêu đề/tên truyện/đọc) + **Figtree**
(sans, UI). Dùng helper, truyền `size`/`color` khi cần:

| Helper | Font | Dùng cho |
|---|---|---|
| `AppType.hero(size,color)` | Spectral 700 | tiêu đề màn / logo (h 1.12) |
| `AppType.section(color)` | Spectral 700 / 16 | header mục |
| `AppType.serif(size,w,color,height)` | Spectral 400 / 1.78 | **body đọc Reader** |
| `AppType.item(size,color)` | Figtree 700 | tên item (card) |
| `AppType.body(size,w,color)` | Figtree 400 / 1.4 | body UI |
| `AppType.meta(size,color)` | Figtree 600 | chữ phụ (muted) |
| `AppType.btn(size,color)` | Figtree 700 | nhãn nút |
| `AppType.tabLabel(color)` | Figtree 800 / 11 | nhãn tab bar |

`color` để `null` ⇒ kế thừa màu chữ mặc định (`ink`) từ `ThemeData.textTheme`.

═══════════════════════════════════════════════════════════════════════
## 3. SPACING & BO GÓC — `Gap`, `Radii` (`theme/app_dimens.dart`)
═══════════════════════════════════════════════════════════════════════

- **`Gap`**: `screenH=16` (padding ngang màn), `xs=4, sm=8, md=12, lg=16, xl=22, xxl=32`.
- **`Radii`**: `card=13, cover=10, button=13, pill=20, sheet=22`.
- **`rounded(r)`** → `BorderRadius.circular(r)` (tiện cho `decoration`).

→ Dùng các hằng này thay số rời để giữ nhịp thị giác đồng nhất.

═══════════════════════════════════════════════════════════════════════
## 4. DỰNG THEME — `AppTheme` (`theme/app_theme.dart`)
═══════════════════════════════════════════════════════════════════════

`AppTheme.light()/dark()` → `ThemeData` (Material 3): `scaffoldBackgroundColor = pal.bg`,
gắn `AppPalette` vào `extensions`, `colorScheme.fromSeed(terracotta)`, `textTheme =
GoogleFonts.figtreeTextTheme(...)` (bodyColor/displayColor = `ink`), `splashFactory =
InkRipple`. `main.dart` chọn light/dark theo `AppState.themeMode`.

═══════════════════════════════════════════════════════════════════════
## 5. `CoverImage` (`widgets/cover_image.dart`)
═══════════════════════════════════════════════════════════════════════

Bìa truyện/nhạc + **placeholder gradient** khi thiếu ảnh.

```dart
CoverImage(path: book.cover, title: book.title, radius: Radii.cover, aspect: 3/4)
```

- **Asset vs URL** (tự nhận theo `path`): `http(s)://` → **`CachedNetworkImage`** (cover
  backend R2/Cloudflare — cache RAM + đĩa, có `placeholder` + `errorWidget`); còn lại →
  `Image.asset`. Cả hai lỗi/thiếu đều rơi về `_placeholder()`.
- `aspect`: bìa truyện **3:4**, bìa nhạc/album **1:1** (truyền `aspect: 1`).
- **`_placeholder()`**: gradient chọn theo `title.hashCode` (ổn định theo tên) + tên ở
  giữa. Nhờ vậy vẫn đẹp khi `assets/covers/` trống hoặc URL đang tải/lỗi.
- **Cache giải mã**: `cacheWidth`/`memCacheWidth`/`maxWidthDiskCache = 260 * DPR` → giải
  mã/cache ở ~kích thước hiển thị, không full-res; asset thêm `gaplessPlayback: true`.
  Giảm giật khi cuộn. Xem [06](06-cache-va-tai-nguyen.md).

═══════════════════════════════════════════════════════════════════════
## 6. BOTTOM-SHEETS DÙNG CHUNG (`widgets/sheets.dart`)
═══════════════════════════════════════════════════════════════════════

Helper `_showSheet<T>` chuẩn hoá: nền `pal.card`, barrier tối, radius trên 22, handle
38×4, chừa `viewInsets.bottom` cho bàn phím, `SafeArea`. 4 sheet công khai:

| Hàm | Mục đích | Trả về / hiệu ứng |
|---|---|---|
| `showUnlockSheet(ctx, book, ch)` | Mở khoá chương: coin / free pass / xem ad / auto | `Future<bool>`; nếu mở → `app.unlockChapter`. Thiếu coin → snackbar. |
| `showGiftSheet(ctx, author)` | Tặng quà tác giả (lưới `Demo.gifts`) | trừ coin (`spendCoins`) + snackbar. |
| `showCommentSheet(ctx)` | Bình luận (prototype, thêm vào list cục bộ) | `StatefulBuilder` + `TextEditingController`. |
| `showRatingSheet(ctx, title)` | Đánh giá sao; ≥4★ gợi ý ra store | snackbar theo số sao. |

> Các sheet đọc state qua `context.read<AppState>()` và đóng bằng `Navigator.pop(c, kq)`.
> Khi nối backend: thay thao tác cục bộ (spend coin, add comment) bằng gọi API tương ứng
> (unlock chapter, post comment/review) — xem [07](07-noi-backend.md).

═══════════════════════════════════════════════════════════════════════
## 7. WIDGET CỤC BỘ ĐÁNG CHÚ Ý (không ở `widgets/` nhưng tái dùng ý tưởng)
═══════════════════════════════════════════════════════════════════════

- `_BottomNav`, `_MiniPlayer` (trong `app_shell.dart`): nav đổi màu/nhãn theo chế độ;
  mini-player toàn cục. Là private vì chỉ shell dùng — nếu cần dùng nơi khác mới tách ra `widgets/`.

→ Quy tắc tách component: **dùng ≥2 nơi** mới đưa vào `widgets/`; còn lại để private trong file màn.
