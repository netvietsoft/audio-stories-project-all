# `lib/l10n/` — Đa ngôn ngữ HIỂN THỊ (i18n)

Tập trung **chuỗi giao diện** (menu, tiêu đề, nút…) để dịch sang nhiều ngôn ngữ dễ dàng.
Dùng cơ chế chuẩn Flutter **gen-l10n** (ARB → sinh `AppLocalizations`).

> ⚠ Phân biệt với **ngôn ngữ NỘI DUNG** (`AppState.contentLang`, lọc truyện/thể loại qua
> param API `lang`) — đó KHÔNG phải i18n. i18n ở đây chỉ dịch **chữ giao diện**, điều khiển
> bởi `AppState.uiLang` (→ `Locale` của MaterialApp). Hai thứ độc lập (xem docs/07 nếu cần).

## Cấu trúc
```
lib/l10n/
├── app_en.arb        ← TEMPLATE (tiếng Anh) + mô tả @key. Nguồn khoá chuẩn.
├── app_vi.arb        ← bản dịch tiếng Việt (cùng bộ khoá)
├── l10n_ext.dart     ← extension: context.l10n.<key>
├── gen/              ← CODE SINH TỰ ĐỘNG — ĐỪNG sửa tay
│   ├── app_localizations.dart
│   ├── app_localizations_en.dart
│   └── app_localizations_vi.dart
└── README.md
```
Cấu hình: `../../l10n.yaml` (arb-dir, output-dir…) + `pubspec.yaml` mục `flutter: generate: true`.
Wiring: `main.dart` (MaterialApp `locale: Locale(app.uiLang)`, `localizationsDelegates`,
`supportedLocales` từ `AppLocalizations`).

## Dùng trong code
```dart
import '../l10n/l10n_ext.dart';
// ...
Text(context.l10n.navHome)   // 'Home' / 'Trang chủ' theo uiLang
```

## Thêm 1 chuỗi mới
1. Thêm khoá vào **`app_en.arb`** (kèm `"@key": {"description": "..."}`).
2. Thêm CÙNG khoá vào **`app_vi.arb`** (và mọi `app_*.arb` khác).
3. Sinh lại: `flutter gen-l10n` (hoặc `flutter pub get`).
4. Dùng `context.l10n.key`.

## Thêm 1 NGÔN NGỮ mới (vd tiếng Trung `zh`)
1. Tạo `lib/l10n/app_zh.arb` — copy toàn bộ khoá từ `app_en.arb`, đổi `"@@locale": "zh"` + dịch.
2. `flutter gen-l10n` → `AppLocalizations.supportedLocales` tự có `zh` (MaterialApp tự nhận).
3. Thêm dòng vào bảng chọn: `_langs` trong `lib/screens/account/account_screens.dart`
   (`'zh': '中文'`) để người dùng chọn được.
4. Xong — `AppState.setUiLang('zh')` → UI dịch sang tiếng Trung.

## Placeholder / số nhiều (ICU)
```json
"greeting": "Hello {name}", "@greeting": { "placeholders": { "name": {"type": "String"} } },
"items": "{count, plural, =0{Trống} =1{1 mục} other{{count} mục}}",
"@items": { "placeholders": { "count": {"type": "num"} } }
```
Dùng: `context.l10n.greeting('Tony')`, `context.l10n.items(5)`.

## Lệnh
```bash
flutter gen-l10n     # sinh lại sau khi sửa .arb
flutter pub get      # cũng chạy gen (generate: true)
```

## Trạng thái
- Đã có khoá khởi đầu: menu (nav*), chế độ (mode*), cài đặt ngôn ngữ, vài section Home.
- Đã áp l10n ở: bottom nav (`app_shell`), toggle Novel/Audio (`novel_home`), màn Language Settings.
- CÒN LẠI: các chuỗi cứng khác (nút Read Now/Listen, các màn detail/player/money/onboarding…)
  chuyển dần sang `context.l10n.*` — thêm khoá vào 2 file .arb rồi thay chuỗi.

> `gen/` là code sinh; có thể commit hoặc gitignore (được tạo lại khi `gen-l10n`/`pub get`).
