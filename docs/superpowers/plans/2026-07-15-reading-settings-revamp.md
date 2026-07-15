# Reading Settings Revamp (slider + custom color) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sheet cài đặt đọc "Aa": TEXT SIZE và LINE thành slider (14–30 / 1.4–3.0), nền OLED thành ô Custom mở color picker, màu chữ bỏ Auto (mặc định Đen) + ô picker cuối bảng.

**Architecture:** `ReaderSettings` thêm `customBg` + hàm thuần `resolveLegacySettings()` (resolve OLED cũ → custom đen, Auto cũ → đen/kem-sáng theo độ tối nền) gọi 1 lần ở `initState`. UI sheet sửa 4 khối trong `reader_screen.dart`; picker dùng package `flutter_colorpicker` trong `AlertDialog`. Persist qua `ReaderStore` như cũ, không đổi key prefs.

**Tech Stack:** Flutter (Dart ^3.12.2), shared_preferences (đã có), `flutter_colorpicker: ^1.1.0` (dep MỚI — đã chốt với user).

**Spec:** `docs/superpowers/specs/2026-07-15-reading-settings-revamp-design.md`

## Global Constraints

- Dart SDK `^3.12.2`; dep mới DUY NHẤT: `flutter_colorpicker: ^1.1.0`.
- KHÔNG đổi key prefs `reader.settings`; KHÔNG migration file — resolve legacy bằng hàm thuần lúc load.
- KHÔNG đụng: Brightness, Read-along, Font, Margin, top bar, luồng đọc/audio, BE.
- Slider persist ở `onChangeEnd` (không ghi prefs mỗi frame kéo); giá trị hiển thị cập nhật live (setSheet + setState).
- Hằng màu: Đen mặc định `0xFF000000`; kem sáng legacy nền tối `0xFFE8DCC4` (= `_inks[3]` của Reader).
- `_bgs`/`_bgLabels` GIỮ nguyên 5 phần tử (index 4 không render preset nữa — thành ô Custom).
- Flutter KHÔNG trong PATH → mọi lệnh flutter dùng `"/d/SetupC/flutter/bin/flutter.bat"` (bash).
- Git repo tại `D:\SetupC\Projects\NovelApp\novelverse` (branch master); commit mỗi task, kết body bằng `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Model — `ReaderSettings.customBg` + `resolveLegacySettings`

**Files:**
- Modify: `lib/data/reader/reader_models.dart:1-58` (class `ReaderSettings`; thêm hàm + hằng top-level)
- Test: `test/data/reader/reader_models_test.dart` (thêm 2 test mới vào file có sẵn)

**Interfaces:**
- Produces: `ReaderSettings.customBg: int?` (named param, default null; roundtrip toMap/fromMap; copyWith); hằng `kDefaultTextColor = 0xFF000000`, `kLegacyDarkInk = 0xFFE8DCC4`; hàm thuần `ReaderSettings resolveLegacySettings(ReaderSettings s)`. Task 3 gọi `resolveLegacySettings` trong `initState` và đọc/ghi `customBg`.

- [ ] **Step 1: Viết test thất bại** — THÊM vào cuối `main()` của `test/data/reader/reader_models_test.dart` (giữ nguyên 2 test cũ):

```dart
  test('customBg round-trip + thiếu key → null', () {
    const s = ReaderSettings(bg: 4, customBg: 0xFF101820, textColor: 0xFF000000);
    final back = ReaderSettings.fromMap(s.toMap());
    expect(back.customBg, 0xFF101820);
    expect(ReaderSettings.fromMap(const {}).customBg, isNull);
    expect(s.copyWith(fontSize: 20).customBg, 0xFF101820); // copyWith giữ customBg
  });

  test('resolveLegacySettings: OLED cũ + Auto cũ resolve đúng', () {
    // bg=4 (OLED cũ) thiếu customBg → customBg = đen, Auto trên nền đó → kem sáng
    final oled = resolveLegacySettings(ReaderSettings.fromMap(const {'bg': 4}));
    expect(oled.customBg, 0xFF000000);
    expect(oled.textColor, kLegacyDarkInk);
    // Auto trên nền Dark preset → kem sáng
    expect(resolveLegacySettings(const ReaderSettings(bg: 3)).textColor, kLegacyDarkInk);
    // Auto trên custom TỐI → kem sáng
    expect(resolveLegacySettings(const ReaderSettings(bg: 4, customBg: 0xFF101010)).textColor, kLegacyDarkInk);
    // Auto trên nền SÁNG (Cream) → Đen mặc định
    expect(resolveLegacySettings(const ReaderSettings(bg: 0)).textColor, kDefaultTextColor);
    // Đã có textColor → giữ nguyên
    expect(resolveLegacySettings(const ReaderSettings(bg: 3, textColor: 0xFF112233)).textColor, 0xFF112233);
  });
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reader/reader_models_test.dart`
Expected: FAIL compile — `No named parameter with the name 'customBg'` / `resolveLegacySettings` undefined.

- [ ] **Step 3: Sửa `lib/data/reader/reader_models.dart`** — thay class `ReaderSettings` (dòng 1-58) bằng:

```dart
/// Cấu hình đọc (toàn cục). Số double/int hoá để lưu prefs (JSON).
class ReaderSettings {
  const ReaderSettings({
    this.bg = 0,
    this.customBg,
    this.textColor,
    this.fontSize = 18,
    this.font = 'serif',
    this.lineHeight = 1.6,
    this.margin = 'medium',
  });

  final int bg;          // index nền: 0 Cream · 1 White · 2 Sepia · 3 Dark · 4 Custom
  final int? customBg;   // ARGB nền custom; chỉ có nghĩa khi bg == 4
  final int? textColor;  // ARGB; null chỉ còn ở settings cũ (Auto) → resolveLegacySettings xử lý
  final double fontSize;
  final String font;     // serif · sans · dyslexia
  final double lineHeight;
  final String margin;   // narrow · medium · wide

  ReaderSettings copyWith({
    int? bg,
    int? customBg,
    int? textColor,
    bool clearTextColor = false,
    double? fontSize,
    String? font,
    double? lineHeight,
    String? margin,
  }) =>
      ReaderSettings(
        bg: bg ?? this.bg,
        customBg: customBg ?? this.customBg,
        textColor: clearTextColor ? null : (textColor ?? this.textColor),
        fontSize: fontSize ?? this.fontSize,
        font: font ?? this.font,
        lineHeight: lineHeight ?? this.lineHeight,
        margin: margin ?? this.margin,
      );

  Map<String, dynamic> toMap() => {
        'bg': bg,
        'customBg': customBg,
        'textColor': textColor,
        'fontSize': fontSize,
        'font': font,
        'lineHeight': lineHeight,
        'margin': margin,
      };

  factory ReaderSettings.fromMap(Map map) {
    double d(dynamic v, double dflt) => v is num ? v.toDouble() : dflt;
    int i(dynamic v, int dflt) => v is num ? v.toInt() : dflt;
    return ReaderSettings(
      bg: i(map['bg'], 0),
      customBg: map['customBg'] is num ? (map['customBg'] as num).toInt() : null,
      textColor: map['textColor'] is num ? (map['textColor'] as num).toInt() : null,
      fontSize: d(map['fontSize'], 18),
      font: (map['font'] ?? 'serif').toString(),
      lineHeight: d(map['lineHeight'], 1.6),
      margin: (map['margin'] ?? 'medium').toString(),
    );
  }
}

/// Màu chữ mặc định (Đen) — semantics mới sau khi bỏ Auto.
const int kDefaultTextColor = 0xFF000000;

/// Màu chữ auto CŨ trên nền tối (kem sáng — trùng `_inks[3]` của Reader).
const int kLegacyDarkInk = 0xFFE8DCC4;

/// Resolve settings bản cũ về semantics mới. Gọi 1 lần lúc load (initState Reader):
/// - `bg == 4` (OLED cũ) thiếu `customBg` → `customBg = đen` (giữ trải nghiệm OLED).
/// - `textColor == null` (Auto cũ) → nền tối: [kLegacyDarkInk]; nền sáng: [kDefaultTextColor]
///   (tránh "chữ đen trên nền đen" cho user cũ đang dùng Dark/OLED + Auto).
ReaderSettings resolveLegacySettings(ReaderSettings s) {
  var out = s;
  if (out.bg == 4 && out.customBg == null) {
    out = out.copyWith(customBg: kOledBlackBg);
  }
  if (out.textColor == null) {
    out = out.copyWith(textColor: _isDarkBg(out) ? kLegacyDarkInk : kDefaultTextColor);
  }
  return out;
}

/// Nền OLED cũ (đen thuần) — giá trị customBg khi migrate bg=4 cũ.
const int kOledBlackBg = 0xFF000000;

bool _isDarkBg(ReaderSettings s) {
  if (s.bg == 3) return true; // Dark preset
  if (s.bg == 4) {
    final c = s.customBg ?? kOledBlackBg;
    final r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }
  return false; // 0 Cream · 1 White · 2 Sepia — nền sáng
}
```

(Phần `ReaderPosition`/`Bookmark` phía dưới GIỮ NGUYÊN.)

- [ ] **Step 4: Chạy test → PASS**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reader/reader_models_test.dart`
Expected: PASS (4 tests: 2 cũ + 2 mới).

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/data/reader/reader_models.dart test/data/reader/reader_models_test.dart
git commit -m "feat(reader): ReaderSettings.customBg + resolveLegacySettings (OLED/Auto cũ)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Sheet — TEXT SIZE + LINE thành slider

**Files:**
- Modify: `lib/screens/novel/reader_screen.dart:861-886` (2 khối TEXT SIZE + LINE trong sheet `_openSettings`)

**Interfaces:**
- Consumes: field `_fontSize`, `_lineHeight`, helper `label()`, `_persistSettings()`, `setSheet` (StatefulBuilder) — tất cả đã có trong file.
- Produces: không interface mới. LƯU Ý: KHÔNG dùng helper `upd()` cho slider (upd persist mỗi lần gọi) — live update bằng setSheet+setState, persist ở `onChangeEnd`.

- [ ] **Step 1: Thay 2 khối UI.** Trong sheet (sau khối FONT, trước MARGIN), thay:

```dart
                // TEXT SIZE
                label('TEXT SIZE'),
                Row(children: [
                  Expanded(child: pill('A −', false, () => upd(() => _fontSize = (_fontSize - 1).clamp(14, 26)))),
                  SizedBox(width: 80, child: Center(child: Text('${_fontSize.round()} pt', style: AppType.item(size: 15, color: pal.ink)))),
                  Expanded(child: pill('A +', false, () => upd(() => _fontSize = (_fontSize + 1).clamp(14, 26)))),
                ]),
```

bằng:

```dart
                // TEXT SIZE
                label('TEXT SIZE'),
                Row(children: [
                  Text('A', style: AppType.body(size: 13, color: pal.muted)),
                  Expanded(child: Slider(
                    value: _fontSize.clamp(14.0, 30.0),
                    min: 14, max: 30, divisions: 16,
                    activeColor: AppPalette.terracotta,
                    onChanged: (v) { final nv = v.roundToDouble(); setSheet(() => _fontSize = nv); setState(() {}); },
                    onChangeEnd: (_) => _persistSettings(),
                  )),
                  Text('A', style: AppType.body(size: 20, color: pal.muted)),
                  SizedBox(width: 52, child: Text('${_fontSize.round()} pt', textAlign: TextAlign.right, style: AppType.item(size: 13.5, color: pal.ink))),
                ]),
```

và thay:

```dart
                // LINE
                label('LINE'),
                Row(children: [
                  for (final h in const [1.4, 1.6, 1.8, 2.0]) ...[
                    Expanded(child: pill(h.toString(), _lineHeight == h, () => upd(() => _lineHeight = h))),
                    if (h != 2.0) const SizedBox(width: Gap.sm),
                  ],
                ]),
```

bằng:

```dart
                // LINE
                label('LINE'),
                Row(children: [
                  Icon(Icons.format_line_spacing, size: 18, color: pal.muted),
                  Expanded(child: Slider(
                    value: _lineHeight.clamp(1.4, 3.0),
                    min: 1.4, max: 3.0, divisions: 16,
                    activeColor: AppPalette.terracotta,
                    onChanged: (v) { final nv = (v * 10).roundToDouble() / 10; setSheet(() => _lineHeight = nv); setState(() {}); },
                    onChangeEnd: (_) => _persistSettings(),
                  )),
                  SizedBox(width: 32, child: Text(_lineHeight.toStringAsFixed(1), textAlign: TextAlign.right, style: AppType.item(size: 13.5, color: pal.ink))),
                ]),
```

- [ ] **Step 2: Verify compile + suite**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → Expected: 0 lỗi/0 cảnh báo (info có sẵn được phép).
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → Expected: PASS toàn bộ (không test nào đụng 2 khối UI này).

- [ ] **Step 3: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): TEXT SIZE (14-30) + LINE (1.4-3.0) thành slider trong sheet Aa

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Custom color — nền + chữ (flutter_colorpicker)

**Files:**
- Modify: `pubspec.yaml` (thêm dep), `lib/screens/novel/reader_screen.dart` (import, field `_customBg`, `_palette` mới, initState resolve, render bg/ink, `_persistSettings`, khối BACKGROUND + TEXT COLOR, helper `_pickColor`)

**Interfaces:**
- Consumes (Task 1): `resolveLegacySettings(ReaderSettings)`, `ReaderSettings.customBg`, hằng `kOledBlackBg`, `kDefaultTextColor`.
- Produces: không task nào sau phụ thuộc.

- [ ] **Step 1: Thêm dependency** — trong `pubspec.yaml`, ngay dưới dòng `intl: ^0.20.2` thêm:

```yaml
  flutter_colorpicker: ^1.1.0
```

Run: `"/d/SetupC/flutter/bin/flutter.bat" pub get` → Expected: resolve OK, không conflict.

- [ ] **Step 2: Sửa `reader_screen.dart` — 6 điểm:**

2a. Thêm import (nhóm package, sau `import 'package:flutter/rendering.dart' ...`):

```dart
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
```

2b. Field (cạnh `Color? _textColor;` dòng ~47) — thay comment và thêm field:

```dart
  Color? _textColor; // luôn non-null sau initState (resolveLegacySettings); mặc định Đen
  Color? _customBg;  // nền custom (bg == 4); null khi user chưa từng chọn
```

2c. `_palette` (dòng 72-75) — bỏ `null` (Auto), thêm Đen đứng đầu:

```dart
  static const _palette = [
    Color(0xFF000000), Color(0xFF2A2118), Color(0xFF5B4F3A), Color(0xFF8A5A2B), Color(0xFFC2683A),
    Color(0xFF4E6E58), Color(0xFF35506E), Color(0xFF7A5470), Color(0xFF9A3B4A),
  ];
```

2d. `initState` (dòng 81-83) — thay:

```dart
    final s = _reader.readSettings();
    _bg = s.bg;
    _textColor = s.textColor == null ? null : Color(s.textColor!);
```

bằng:

```dart
    final s = resolveLegacySettings(_reader.readSettings());
    _bg = s.bg;
    _customBg = s.customBg == null ? null : Color(s.customBg!);
    _textColor = Color(s.textColor!); // resolve đảm bảo non-null
```

2e. Render trong `build` (dòng 345-346) — thay:

```dart
    final bg = _bgs[_bg];
    final ink = _textColor ?? _inks[_bg];
```

bằng:

```dart
    final bg = _bg == 4 ? (_customBg ?? const Color(kOledBlackBg)) : _bgs[_bg];
    final ink = _textColor ?? const Color(kDefaultTextColor);
```

2f. **XOÁ** hằng `_inks` (dòng 70: `static const _inks = [...]`) — sau 2e nó không còn được dùng ở đâu, để lại sẽ dính warning `unused_field` (giá trị kem sáng nền tối đã chuyển thành `kLegacyDarkInk` trong reader_models từ Task 1).

2g. `_persistSettings` (dòng 302-311) — thêm `customBg` vào constructor:

```dart
  void _persistSettings() {
    _reader.saveSettings(ReaderSettings(
      bg: _bg,
      customBg: _customBg?.toARGB32(),
      textColor: _textColor?.toARGB32(),
      fontSize: _fontSize,
      font: _font,
      lineHeight: _lineHeight,
      margin: _margin,
    ));
  }
```

- [ ] **Step 3: Thêm helper `_pickColor`** (đặt ngay TRƯỚC method `_openSettings` chứa sheet):

```dart
  /// Dialog chọn màu (flutter_colorpicker). Trả màu đã chọn, hoặc null nếu Huỷ.
  Future<Color?> _pickColor(Color initial) async {
    var picked = initial;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: context.pal.card,
        contentPadding: const EdgeInsets.all(Gap.md),
        content: SingleChildScrollView(
          child: ColorPicker(
            pickerColor: initial,
            onColorChanged: (col) => picked = col,
            enableAlpha: false,
            labelTypes: const [],
            pickerAreaHeightPercent: 0.7,
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text('Huỷ', style: AppType.btn(size: 14, color: context.pal.muted))),
          TextButton(onPressed: () => Navigator.pop(c, true), child: Text('Chọn', style: AppType.btn(size: 14, color: AppPalette.terracotta))),
        ],
      ),
    );
    return ok == true ? picked : null;
  }
```

- [ ] **Step 4: Thay khối BACKGROUND** (dòng 809-829 trong sheet) bằng — 4 preset + ô Custom:

```dart
                // BACKGROUND
                label('BACKGROUND'),
                Row(children: [
                  for (var i = 0; i < 4; i++)
                    Expanded(
                      child: GestureDetector(
                        onTap: () => upd(() => _bg = i),
                        child: Column(children: [
                          Container(
                            width: 31, height: 31,
                            decoration: BoxDecoration(
                              color: _bgs[i], shape: BoxShape.circle,
                              border: Border.all(color: _bg == i ? AppPalette.terracotta : pal.line, width: _bg == i ? 2 : 1),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(_bgLabels[i], style: AppType.meta(size: 10.5, color: pal.muted)),
                        ]),
                      ),
                    ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () async {
                        final c = await _pickColor(_customBg ?? const Color(kOledBlackBg));
                        if (c != null) upd(() { _customBg = c; _bg = 4; });
                      },
                      child: Column(children: [
                        Container(
                          width: 31, height: 31,
                          decoration: BoxDecoration(
                            color: _customBg ?? pal.surf2, shape: BoxShape.circle,
                            border: Border.all(color: _bg == 4 ? AppPalette.terracotta : pal.line, width: _bg == 4 ? 2 : 1),
                          ),
                          child: _customBg == null ? Icon(Icons.colorize, size: 16, color: pal.muted) : null,
                        ),
                        const SizedBox(height: 4),
                        Text('Custom', style: AppType.meta(size: 10.5, color: pal.muted)),
                      ]),
                    ),
                  ),
                ]),
```

- [ ] **Step 5: Thay khối TEXT COLOR** (dòng 831-859 trong sheet) bằng — bỏ Auto, thêm ô picker cuối:

```dart
                // TEXT COLOR
                label('TEXT COLOR'),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  for (final col in _palette)
                    GestureDetector(
                      onTap: () => upd(() => _textColor = col),
                      child: Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          color: col, shape: BoxShape.circle,
                          border: Border.all(color: _textColor == col ? AppPalette.terracotta : pal.line, width: _textColor == col ? 2 : 1),
                        ),
                      ),
                    ),
                  Builder(builder: (_) {
                    final isCustom = _textColor != null && !_palette.contains(_textColor);
                    return GestureDetector(
                      onTap: () async {
                        final c = await _pickColor(_textColor ?? const Color(kDefaultTextColor));
                        if (c != null) upd(() => _textColor = c);
                      },
                      child: Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          color: isCustom ? _textColor : pal.surf2, shape: BoxShape.circle,
                          border: Border.all(color: isCustom ? AppPalette.terracotta : pal.line, width: isCustom ? 2 : 1),
                        ),
                        child: isCustom ? null : Icon(Icons.colorize, size: 14, color: pal.muted),
                      ),
                    );
                  }),
                ]),
```

- [ ] **Step 6: Verify compile + suite**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → Expected: 0 lỗi/0 cảnh báo.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add pubspec.yaml pubspec.lock lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): nền + màu chữ custom qua color picker (bỏ OLED preset, bỏ Auto)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Verify toàn bộ + docs

**Files:**
- Modify: `CHANGELOG.md` (entry mới 2026-07-15), `lib/screens/novel/README.md:12` (dòng `reader_screen.dart`)

**Interfaces:** không — task tài liệu + verify.

- [ ] **Step 1: Full verify**

```bash
"/d/SetupC/flutter/bin/flutter.bat" test
"/d/SetupC/flutter/bin/flutter.bat" analyze
```

Expected: test PASS toàn bộ (54 = 52 cũ + 2 mới); analyze 0 lỗi/0 cảnh báo.

- [ ] **Step 2: `CHANGELOG.md`** — chèn TRÊN entry `## 2026-07-14`:

```markdown
## 2026-07-15

### Reading Settings (sheet Aa)
- **TEXT SIZE** và **LINE** chuyển sang thanh kéo: cỡ chữ 14–30 pt (bước 1), giãn dòng 1.4–3.0 (bước 0.1); giá trị hiển thị live, lưu khi thả tay.
- **BACKGROUND**: bỏ preset OLED, thay bằng ô **Custom** mở color picker (`flutter_colorpicker`) — user tự chọn màu nền. Settings cũ đang OLED tự chuyển thành custom đen (không đổi trải nghiệm).
- **TEXT COLOR**: bỏ chip Auto; bảng màu thêm **Đen** đứng đầu (mặc định) + ô picker cuối bảng chọn màu chữ tuỳ ý. User cũ đang Auto trên nền tối được tự chuyển sang chữ kem sáng (không bị "đen trên đen").
- Model: `ReaderSettings.customBg` + `resolveLegacySettings()` (resolve 1 lần lúc mở Reader).

---
```

- [ ] **Step 3: `lib/screens/novel/README.md`** — dòng 12, thay cụm `Chỉnh cỡ chữ/nền (light/sepia/dark)/màu chữ (8 màu);` bằng:

```
Chỉnh cỡ chữ (slider 14–30)/giãn dòng (slider 1.4–3.0)/nền (4 preset + custom color picker)/màu chữ (Đen mặc định + 8 màu + custom picker, không còn Auto);
```

(giữ nguyên phần còn lại của dòng.)

- [ ] **Step 4: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add CHANGELOG.md lib/screens/novel/README.md
git commit -m "docs: Reading Settings revamp (CHANGELOG + novel README)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
