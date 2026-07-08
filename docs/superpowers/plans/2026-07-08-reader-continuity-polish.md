# Reader Continuity & Polish (Spec 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm màn Reader "sâu hơn": lưu settings đọc, auto-resume đúng vị trí, bookmark vị trí + danh sách, thanh % tiến độ, giữ sáng màn hình, tap giữa ẩn/hiện chrome (top-bar trượt), chỉnh sáng in-app.

**Architecture:** Thêm service `ReaderStore` (trên `shared_preferences`) + data class `ReaderSettings`/`ReaderPosition`/`Bookmark`. `ReaderScreen` đọc/ghi qua ReaderStore (provide ở `main.dart`). Thuần client, không đụng `AppState`/offline/`JsonCache`/`TokenStore`.

**Tech Stack:** Flutter (Dart ^3.12.2), shared_preferences (đã có), provider (đã có), wakelock_plus, screen_brightness.

## Global Constraints
- Dart SDK ^3.12.2 (giữ nguyên).
- Settings đọc **toàn cục** (áp mọi truyện), 1 key `reader.settings`.
- Keys: `reader.settings`, `reader.pos.<bookId>`, `reader.bm.<bookId>`, `reader.brightness`.
- `ReaderStore` bọc `shared_preferences`, JSON; đọc đồng bộ (prefs nạp sẵn lúc boot), ghi async; JSON hỏng/thiếu → mặc định, KHÔNG throw.
- `paragraphIndex`/comment/support/share KHÔNG thuộc spec này (Spec 3).
- Không đụng `lib/state/app_state.dart`, offline layer, `json_cache.dart`, `token_store.dart`.
- Flutter KHÔNG trong PATH → mọi lệnh flutter dùng `"/d/SetupC/flutter/bin/flutter.bat"` (bash) / `& "D:\SetupC\flutter\bin\flutter.bat"` (PowerShell).
- Git repo tại `D:\SetupC\Projects\NovelApp\novelverse`; commit mỗi task, kết body bằng `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure
**Tạo mới:**
- `lib/data/reader/reader_models.dart` — `ReaderSettings`, `ReaderPosition`, `Bookmark` (+ toMap/fromMap/copyWith).
- `lib/data/reader/reader_store.dart` — `ReaderStore` facade prefs.
- `test/data/reader/reader_models_test.dart`, `test/data/reader/reader_store_test.dart`.

**Sửa:**
- `lib/main.dart` — provide `ReaderStore`.
- `lib/screens/novel/reader_screen.dart` — nạp/ghi settings, resume, bookmark, progress, chrome/tap, wakelock, brightness.
- `pubspec.yaml` — thêm `wakelock_plus`, `screen_brightness`.

---

## Task 1: reader_models + deps

**Files:**
- Modify: `pubspec.yaml`
- Create: `lib/data/reader/reader_models.dart`
- Test: `test/data/reader/reader_models_test.dart`

**Interfaces:**
- Produces:
  - `class ReaderSettings { final int bg; final int? textColor; final double fontSize; final String font; final double lineHeight; final String margin; const ReaderSettings({...defaults...}); ReaderSettings copyWith({...}); Map<String,dynamic> toMap(); factory ReaderSettings.fromMap(Map); }` — defaults: bg=0, textColor=null, fontSize=18, font='serif', lineHeight=1.6, margin='medium'.
  - `class ReaderPosition { final int chapter; final double offset; final int savedAt; ... toMap/fromMap }`
  - `class Bookmark { final int chapter; final double offset; final String snippet; final int savedAt; ... toMap/fromMap }`

- [ ] **Step 1: Thêm deps**

Run: `"/d/SetupC/flutter/bin/flutter.bat" pub add wakelock_plus screen_brightness`
Expected: pubspec.yaml có 2 dòng mới, "Got dependencies!". Nếu resolve lỗi → báo BLOCKED với log.

- [ ] **Step 2: Viết test thất bại** — `test/data/reader/reader_models_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/reader/reader_models.dart';

void main() {
  test('ReaderSettings round-trip + defaults khi thiếu key', () {
    const s = ReaderSettings(bg: 3, textColor: 0xFF112233, fontSize: 20, font: 'sans', lineHeight: 1.8, margin: 'wide');
    final back = ReaderSettings.fromMap(s.toMap());
    expect(back.bg, 3);
    expect(back.textColor, 0xFF112233);
    expect(back.fontSize, 20);
    expect(back.font, 'sans');
    expect(back.lineHeight, 1.8);
    expect(back.margin, 'wide');
    // thiếu key → default
    final def = ReaderSettings.fromMap(const {});
    expect(def.bg, 0);
    expect(def.textColor, isNull);
    expect(def.fontSize, 18);
    expect(def.font, 'serif');
    expect(def.lineHeight, 1.6);
    expect(def.margin, 'medium');
  });

  test('ReaderPosition + Bookmark round-trip', () {
    const p = ReaderPosition(chapter: 5, offset: 123.4, savedAt: 999);
    final pb = ReaderPosition.fromMap(p.toMap());
    expect(pb.chapter, 5);
    expect(pb.offset, 123.4);
    expect(pb.savedAt, 999);

    const b = Bookmark(chapter: 2, offset: 50.0, snippet: 'hello', savedAt: 111);
    final bb = Bookmark.fromMap(b.toMap());
    expect(bb.chapter, 2);
    expect(bb.offset, 50.0);
    expect(bb.snippet, 'hello');
    expect(bb.savedAt, 111);
  });
}
```

- [ ] **Step 3: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reader/reader_models_test.dart`
Expected: FAIL ("Target of URI doesn't exist" / classes chưa có).

- [ ] **Step 4: Viết `reader_models.dart`**

```dart
/// Cấu hình đọc (toàn cục). Số double/int hoá để lưu prefs (JSON).
class ReaderSettings {
  const ReaderSettings({
    this.bg = 0,
    this.textColor,
    this.fontSize = 18,
    this.font = 'serif',
    this.lineHeight = 1.6,
    this.margin = 'medium',
  });

  final int bg;          // index nền: 0 Cream · 1 White · 2 Sepia · 3 Dark · 4 OLED
  final int? textColor;  // ARGB; null = Auto
  final double fontSize;
  final String font;     // serif · sans · dyslexia
  final double lineHeight;
  final String margin;   // narrow · medium · wide

  ReaderSettings copyWith({
    int? bg,
    int? textColor,
    bool clearTextColor = false,
    double? fontSize,
    String? font,
    double? lineHeight,
    String? margin,
  }) =>
      ReaderSettings(
        bg: bg ?? this.bg,
        textColor: clearTextColor ? null : (textColor ?? this.textColor),
        fontSize: fontSize ?? this.fontSize,
        font: font ?? this.font,
        lineHeight: lineHeight ?? this.lineHeight,
        margin: margin ?? this.margin,
      );

  Map<String, dynamic> toMap() => {
        'bg': bg,
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
      textColor: map['textColor'] is num ? (map['textColor'] as num).toInt() : null,
      fontSize: d(map['fontSize'], 18),
      font: (map['font'] ?? 'serif').toString(),
      lineHeight: d(map['lineHeight'], 1.6),
      margin: (map['margin'] ?? 'medium').toString(),
    );
  }
}

/// Vị trí đọc gần nhất của 1 truyện (auto-resume).
class ReaderPosition {
  const ReaderPosition({required this.chapter, required this.offset, required this.savedAt});
  final int chapter;
  final double offset;
  final int savedAt;

  Map<String, dynamic> toMap() => {'chapter': chapter, 'offset': offset, 'savedAt': savedAt};

  factory ReaderPosition.fromMap(Map map) => ReaderPosition(
        chapter: map['chapter'] is num ? (map['chapter'] as num).toInt() : 1,
        offset: map['offset'] is num ? (map['offset'] as num).toDouble() : 0,
        savedAt: map['savedAt'] is num ? (map['savedAt'] as num).toInt() : 0,
      );
}

/// Bookmark 1 vị trí đọc do người dùng lưu.
class Bookmark {
  const Bookmark({required this.chapter, required this.offset, required this.snippet, required this.savedAt});
  final int chapter;
  final double offset;
  final String snippet;
  final int savedAt;

  Map<String, dynamic> toMap() => {'chapter': chapter, 'offset': offset, 'snippet': snippet, 'savedAt': savedAt};

  factory Bookmark.fromMap(Map map) => Bookmark(
        chapter: map['chapter'] is num ? (map['chapter'] as num).toInt() : 1,
        offset: map['offset'] is num ? (map['offset'] as num).toDouble() : 0,
        snippet: (map['snippet'] ?? '').toString(),
        savedAt: map['savedAt'] is num ? (map['savedAt'] as num).toInt() : 0,
      );
}
```

- [ ] **Step 5: Chạy test → PASS**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reader/reader_models_test.dart`
Expected: PASS (2 test).

- [ ] **Step 6: Commit**

```bash
git add pubspec.yaml pubspec.lock lib/data/reader/reader_models.dart test/data/reader/reader_models_test.dart
git commit -m "feat(reader): deps + reader models (settings/position/bookmark)"
```

---

## Task 2: ReaderStore

**Files:**
- Create: `lib/data/reader/reader_store.dart`
- Test: `test/data/reader/reader_store_test.dart`

**Interfaces:**
- Consumes: `reader_models.dart` (Task 1), `SharedPreferences`.
- Produces:
  - `class ReaderStore { ReaderStore(SharedPreferences prefs); ReaderSettings readSettings(); Future<void> saveSettings(ReaderSettings s); ReaderPosition? position(String bookId); Future<void> savePosition(String bookId, int chapter, double offset); List<Bookmark> bookmarks(String bookId); Future<void> addBookmark(String bookId, Bookmark b); Future<void> removeBookmark(String bookId, int savedAt); double readBrightness(); Future<void> saveBrightness(double v); }`
  - `readBrightness()` mặc định `-1` (theo hệ thống) nếu chưa lưu.

- [ ] **Step 1: Viết test thất bại** — `test/data/reader/reader_store_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:novelverse/data/reader/reader_models.dart';
import 'package:novelverse/data/reader/reader_store.dart';

void main() {
  late ReaderStore store;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    store = ReaderStore(await SharedPreferences.getInstance());
  });

  test('settings mặc định khi trống, round-trip sau khi lưu', () async {
    expect(store.readSettings().fontSize, 18);
    await store.saveSettings(const ReaderSettings(fontSize: 22, bg: 2));
    expect(store.readSettings().fontSize, 22);
    expect(store.readSettings().bg, 2);
  });

  test('position: null khi chưa có, đọc đúng sau khi lưu', () async {
    expect(store.position('b1'), isNull);
    await store.savePosition('b1', 4, 88.0);
    final p = store.position('b1')!;
    expect(p.chapter, 4);
    expect(p.offset, 88.0);
  });

  test('bookmark add → list → remove', () async {
    expect(store.bookmarks('b1'), isEmpty);
    await store.addBookmark('b1', const Bookmark(chapter: 1, offset: 0, snippet: 'a', savedAt: 100));
    await store.addBookmark('b1', const Bookmark(chapter: 2, offset: 5, snippet: 'b', savedAt: 200));
    expect(store.bookmarks('b1').length, 2);
    await store.removeBookmark('b1', 100);
    final left = store.bookmarks('b1');
    expect(left.length, 1);
    expect(left.first.savedAt, 200);
  });

  test('brightness mặc định -1, round-trip', () async {
    expect(store.readBrightness(), -1);
    await store.saveBrightness(0.6);
    expect(store.readBrightness(), 0.6);
  });

  test('JSON hỏng → trả mặc định, không throw', () async {
    SharedPreferences.setMockInitialValues({'reader.settings': 'not-json', 'reader.pos.b1': '{bad'});
    final s2 = ReaderStore(await SharedPreferences.getInstance());
    expect(s2.readSettings().fontSize, 18);
    expect(s2.position('b1'), isNull);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reader/reader_store_test.dart`
Expected: FAIL (ReaderStore chưa có).

- [ ] **Step 3: Viết `reader_store.dart`**

```dart
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'reader_models.dart';

/// Lưu cấu hình đọc + vị trí resume + bookmark + brightness (shared_preferences, JSON).
/// Dữ liệu nhỏ → prefs đủ. Đọc đồng bộ (prefs nạp sẵn), ghi async. Hỏng → mặc định.
class ReaderStore {
  ReaderStore(this._prefs);
  final SharedPreferences _prefs;

  static const _kSettings = 'reader.settings';
  static const _kBrightness = 'reader.brightness';
  static String _posKey(String bookId) => 'reader.pos.$bookId';
  static String _bmKey(String bookId) => 'reader.bm.$bookId';

  Map? _decodeMap(String? s) {
    if (s == null) return null;
    try {
      final v = jsonDecode(s);
      return v is Map ? v : null;
    } catch (_) {
      return null;
    }
  }

  // ── settings ──
  ReaderSettings readSettings() => ReaderSettings.fromMap(_decodeMap(_prefs.getString(_kSettings)) ?? const {});

  Future<void> saveSettings(ReaderSettings s) => _prefs.setString(_kSettings, jsonEncode(s.toMap()));

  // ── position ──
  ReaderPosition? position(String bookId) {
    final m = _decodeMap(_prefs.getString(_posKey(bookId)));
    return m == null ? null : ReaderPosition.fromMap(m);
  }

  Future<void> savePosition(String bookId, int chapter, double offset) => _prefs.setString(
      _posKey(bookId),
      jsonEncode(ReaderPosition(
              chapter: chapter, offset: offset, savedAt: DateTime.now().millisecondsSinceEpoch)
          .toMap()));

  // ── bookmarks ──
  List<Bookmark> bookmarks(String bookId) {
    final raw = _prefs.getString(_bmKey(bookId));
    if (raw == null) return const [];
    try {
      final list = jsonDecode(raw);
      if (list is! List) return const [];
      return list.whereType<Map>().map(Bookmark.fromMap).toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> addBookmark(String bookId, Bookmark b) async {
    final list = [...bookmarks(bookId), b]..sort((x, y) => y.savedAt.compareTo(x.savedAt));
    await _prefs.setString(_bmKey(bookId), jsonEncode(list.map((e) => e.toMap()).toList()));
  }

  Future<void> removeBookmark(String bookId, int savedAt) async {
    final list = bookmarks(bookId).where((e) => e.savedAt != savedAt).toList();
    await _prefs.setString(_bmKey(bookId), jsonEncode(list.map((e) => e.toMap()).toList()));
  }

  // ── brightness ──
  double readBrightness() => _prefs.getDouble(_kBrightness) ?? -1;
  Future<void> saveBrightness(double v) => _prefs.setDouble(_kBrightness, v);
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reader/reader_store_test.dart`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add lib/data/reader/reader_store.dart test/data/reader/reader_store_test.dart
git commit -m "feat(reader): ReaderStore over shared_preferences"
```

---

## Task 3: Provide ReaderStore + persist reading settings

**Files:**
- Modify: `lib/main.dart`
- Modify: `lib/screens/novel/reader_screen.dart`
- Test: (không unit mới — verify analyze + suite + thủ công)

**Interfaces:**
- Consumes: `ReaderStore` (Task 2).
- Produces: `context.read<ReaderStore>()` khả dụng; ReaderScreen nạp settings lúc mở, ghi mỗi khi đổi.

- [ ] **Step 1: main.dart — provide ReaderStore**

Trong `lib/main.dart`, reuse `SharedPreferences` đã lấy cho `JsonCache`. Tìm dòng:
```dart
  final cache = JsonCache(await SharedPreferences.getInstance());
```
Đổi thành:
```dart
  final prefs = await SharedPreferences.getInstance();
  final cache = JsonCache(prefs);
  final readerStore = ReaderStore(prefs);
```
Thêm import: `import 'data/reader/reader_store.dart';`
Thêm field vào `NovelVerseApp` (`final ReaderStore readerStore;` + tham số ctor `required this.readerStore,`), truyền khi `runApp(NovelVerseApp(... readerStore: readerStore, ...))`, và trong `MultiProvider` thêm:
```dart
        Provider.value(value: readerStore),
```

- [ ] **Step 2: reader_screen — nạp settings lúc mở**

Trong `_ReaderScreenState`:
- Thêm import: `import '../../data/reader/reader_store.dart';` và `import '../../data/reader/reader_models.dart';`
- Thêm field: `late final ReaderStore _reader;`
- Trong `initState` (sau `_repo = context.read<StoriesRepository>();`) thêm:
```dart
    _reader = context.read<ReaderStore>();
    final s = _reader.readSettings();
    _bg = s.bg;
    _textColor = s.textColor == null ? null : Color(s.textColor!);
    _fontSize = s.fontSize;
    _font = s.font;
    _lineHeight = s.lineHeight;
    _margin = s.margin;
```

- [ ] **Step 3: reader_screen — ghi settings khi đổi**

Thêm helper trong state:
```dart
  void _persistSettings() {
    _reader.saveSettings(ReaderSettings(
      bg: _bg,
      textColor: _textColor?.toARGB32(),
      fontSize: _fontSize,
      font: _font,
      lineHeight: _lineHeight,
      margin: _margin,
    ));
  }
```
Trong `_openSettings`, hàm `upd(VoidCallback fn)` hiện có:
```dart
          void upd(VoidCallback fn) {
            setSheet(fn);
            setState(fn);
          }
```
đổi thành:
```dart
          void upd(VoidCallback fn) {
            setSheet(fn);
            setState(fn);
            _persistSettings();
          }
```
> `Color.toARGB32()` có trong Flutter SDK hiện tại (thay `.value`). Nếu analyzer báo không có, dùng `_textColor!.value`.

- [ ] **Step 4: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib/main.dart lib/screens/novel/reader_screen.dart`
Expected: No issues (info-lint pre-existing chấp nhận).
Run: `"/d/SetupC/flutter/bin/flutter.bat" test`
Expected: tất cả PASS.
Thủ công: mở Reader → đổi cỡ chữ/nền → thoát → mở lại truyện khác → settings giữ nguyên.

- [ ] **Step 5: Commit**

```bash
git add lib/main.dart lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): persist reading settings via ReaderStore"
```

---

## Task 4: Auto-resume vị trí đọc

**Files:**
- Modify: `lib/screens/novel/reader_screen.dart`
- Test: (verify analyze + thủ công)

**Interfaces:**
- Consumes: `ReaderStore.position/savePosition` (Task 2), `_reader` (Task 3).
- Produces: mở Reader nhảy tới chương+offset đã lưu; cuộn ghi lại (debounce).

- [ ] **Step 1: Thêm state debounce + import Timer**

Thêm `import 'dart:async';` đầu file. Thêm field: `Timer? _saveDebounce;` và `bool _resumed = false;`
Trong `dispose()` (trước `_scroll.dispose()`): `_saveDebounce?.cancel();` và ghi vị trí cuối:
```dart
    if (_scroll.hasClients) _reader.savePosition(widget.bookId, _chapter, _scroll.offset);
```

- [ ] **Step 2: Ghi vị trí khi cuộn (debounce)**

Trong `_onScroll()` (cuối hàm, sau logic chrome) thêm:
```dart
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(seconds: 1), () {
      if (_scroll.hasClients) _reader.savePosition(widget.bookId, _chapter, _scroll.offset);
    });
```

- [ ] **Step 3: Chọn chương resume khi vào không có `?ch=`**

Router truyền `initialChapter` từ `?ch=`; khi vào từ nút Read/Continue không có query → `initialChapter` null. Trong `_init()`, sau khi có `detail` và trước `_loadContent()`, thêm:
```dart
      if (widget.initialChapter == null) {
        final saved = _reader.position(widget.bookId);
        if (saved != null && detail.chapters.any((c) => c.n == saved.chapter)) {
          _chapter = saved.chapter;
        }
      }
```
(giữ nguyên đoạn `if (nums.isNotEmpty && !nums.contains(_chapter)) _chapter = nums.first;` NGAY TRƯỚC đoạn này.)

- [ ] **Step 4: Nhảy tới offset sau khi nội dung render**

Cuối `_loadContent()` (sau khi `_setContent`), thêm: nếu chưa resume và có vị trí lưu cho chương hiện tại → jump sau frame:
```dart
    if (!_resumed) {
      _resumed = true;
      final saved = _reader.position(widget.bookId);
      if (saved != null && saved.chapter == _chapter && saved.offset > 0) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scroll.hasClients) {
            _scroll.jumpTo(saved.offset.clamp(0, _scroll.position.maxScrollExtent));
          }
        });
      }
    }
```
> Chỉ resume LẦN ĐẦU mở (không nhảy khi người dùng chủ động đổi chương sau đó).

- [ ] **Step 5: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib/screens/novel/reader_screen.dart` → No issues.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS.
Thủ công: đọc giữa 1 chương → thoát → mở lại truyện (từ Home/Read) → về đúng chương + đúng chỗ cuộn.

- [ ] **Step 6: Commit**

```bash
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): auto-resume chapter + scroll position"
```

---

## Task 5: Bookmark vị trí + danh sách

**Files:**
- Modify: `lib/screens/novel/reader_screen.dart`
- Test: (verify analyze + thủ công)

**Interfaces:**
- Consumes: `ReaderStore.bookmarks/addBookmark/removeBookmark` (Task 2), `Bookmark` (Task 1).
- Produces: nút bookmark thật (lưu vị trí) + danh sách bookmark trong sheet danh sách chương.

- [ ] **Step 1: Bỏ bool giả, tính "đã đánh dấu" từ store**

Xoá field `bool _bookmarked = false;`. Thêm helper:
```dart
  String _snippetAtOffset() {
    final paras = _content.split(RegExp(r'\n\s*\n')).map((p) => p.trim()).where((p) => p.isNotEmpty).toList();
    if (paras.isEmpty) return '';
    // ước lượng đoạn theo tỉ lệ cuộn (đủ để nhận diện trong danh sách)
    final frac = (_scroll.hasClients && _scroll.position.maxScrollExtent > 0)
        ? (_scroll.offset / _scroll.position.maxScrollExtent).clamp(0.0, 1.0)
        : 0.0;
    final idx = (frac * (paras.length - 1)).round().clamp(0, paras.length - 1);
    final s = paras[idx];
    return s.length <= 60 ? s : '${s.substring(0, 60)}…';
  }

  void _toggleBookmark() {
    final list = _reader.bookmarks(widget.bookId);
    // Nếu đang ~trùng một bookmark (cùng chương, |offset| < 40) → xoá; ngược lại thêm.
    final off = _scroll.hasClients ? _scroll.offset : 0.0;
    final near = list.where((b) => b.chapter == _chapter && (b.offset - off).abs() < 40).toList();
    if (near.isNotEmpty) {
      _reader.removeBookmark(widget.bookId, near.first.savedAt);
    } else {
      _reader.addBookmark(widget.bookId, Bookmark(
        chapter: _chapter, offset: off, snippet: _snippetAtOffset(),
        savedAt: DateTime.now().millisecondsSinceEpoch));
    }
    setState(() {});
  }

  bool get _isBookmarkedHere {
    final off = _scroll.hasClients ? _scroll.offset : 0.0;
    return _reader.bookmarks(widget.bookId).any((b) => b.chapter == _chapter && (b.offset - off).abs() < 40);
  }
```

- [ ] **Step 2: Đổi nút bookmark trên AppBar**

Dòng hiện tại:
```dart
          IconButton(tooltip: 'Đánh dấu', icon: Icon(_bookmarked ? Icons.bookmark : Icons.bookmark_border, color: ink), onPressed: () => setState(() => _bookmarked = !_bookmarked)),
```
đổi thành:
```dart
          IconButton(tooltip: 'Đánh dấu', icon: Icon(_isBookmarkedHere ? Icons.bookmark : Icons.bookmark_border, color: ink), onPressed: _toggleBookmark),
```

- [ ] **Step 3: Thêm section Bookmarks vào sheet danh sách chương**

Trong `_openChapterList`, ngay trên phần header "Chapters", chèn danh sách bookmark (nếu có):
```dart
          Builder(builder: (_) {
            final bms = _reader.bookmarks(widget.bookId);
            if (bms.isEmpty) return const SizedBox.shrink();
            return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, 4),
                child: Text('Bookmarks', style: AppType.section(color: pal.ink)),
              ),
              for (final b in bms)
                ListTile(
                  dense: true,
                  leading: Icon(Icons.bookmark, size: 18, color: AppPalette.terracotta),
                  title: Text('Ch ${b.chapter} · ${b.snippet}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.body(size: 13.5, color: pal.ink)),
                  trailing: IconButton(
                    icon: Icon(Icons.close, size: 16, color: pal.muted),
                    onPressed: () { _reader.removeBookmark(widget.bookId, b.savedAt); Navigator.pop(c); _openChapterList(chapters); },
                  ),
                  onTap: () {
                    Navigator.pop(c);
                    _goChapter(b.chapter, chapters);
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (_scroll.hasClients) _scroll.jumpTo(b.offset.clamp(0, _scroll.position.maxScrollExtent));
                    });
                  },
                ),
              const Divider(height: 12),
            ]);
          }),
```
> `_openChapterList(chapters)` cần tham số `chapters` — nó đã nhận `List<Chapter> chapters`. Dùng lại biến `chapters` trong scope.

- [ ] **Step 4: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib/screens/novel/reader_screen.dart` → No issues.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS.
Thủ công: tap bookmark → icon đầy; mở danh sách chương → thấy Bookmarks; tap → nhảy đúng chỗ; xoá hoạt động.

- [ ] **Step 5: Commit**

```bash
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): real bookmarks (save position + list to jump)"
```

---

## Task 6: Thanh % tiến độ + "Ch x/y"

**Files:**
- Modify: `lib/screens/novel/reader_screen.dart`
- Test: (verify analyze + thủ công)

**Interfaces:**
- Produces: `ValueNotifier<double> _progress` (0..1) cập nhật khi cuộn; thanh mỏng đáy + nhãn "Ch x/y".

- [ ] **Step 1: Thêm notifier + cập nhật khi cuộn**

Thêm field: `final ValueNotifier<double> _progress = ValueNotifier(0);`
Trong `_onScroll()` (đầu hàm) thêm:
```dart
    if (_scroll.hasClients && _scroll.position.maxScrollExtent > 0) {
      _progress.value = (_scroll.offset / _scroll.position.maxScrollExtent).clamp(0.0, 1.0);
    }
```
Trong `dispose()`: `_progress.dispose();`
Khi đổi chương (`_goChapter`) reset: `_progress.value = 0;`

- [ ] **Step 2: Nhãn "Ch x/y" vào phụ đề top-bar**

Dòng phụ đề hiện tại:
```dart
            Text('Chapter ${ch.n} · ${ch.title}',
```
đổi text thành:
```dart
            Text('Ch ${ch.n}/${chapters.length} · ${ch.title}',
```
> `chapters` đã có trong scope `build`.

- [ ] **Step 3: Thanh % mỏng phía trên bottom-nav**

Trong `_readerNav` — bọc thêm 1 thanh mỏng phía trên. Sửa đầu `_readerNav` return, thêm phía trên `Row` bottom-nav:
```dart
    return Container(
      decoration: BoxDecoration(color: bg, border: Border(top: BorderSide(color: ink.withValues(alpha: 0.12)))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ValueListenableBuilder<double>(
          valueListenable: _progress,
          builder: (_, v, __) => LinearProgressIndicator(
            value: v, minHeight: 2.5,
            backgroundColor: ink.withValues(alpha: 0.10), color: AppPalette.terracotta),
        ),
        SafeArea(
          top: false,
          child: SizedBox(
            height: 60,
            child: Row(children: [ /* ... nội dung 4 tab GIỮ NGUYÊN ... */ ]),
          ),
        ),
      ]),
    );
```
> Di chuyển `SafeArea(...SizedBox(height:60, child: Row(...)))` hiện có vào trong Column mới; giữ nguyên nội dung Row 4 tab.

- [ ] **Step 4: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib/screens/novel/reader_screen.dart` → No issues.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS.
Thủ công: cuộn → thanh terracotta ở đáy chạy theo %; phụ đề hiện "Ch x/y".

- [ ] **Step 5: Commit**

```bash
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): reading progress bar + chapter x/y"
```

---

## Task 7: Top-bar trượt + tap giữa ẩn/hiện chrome

**Files:**
- Modify: `lib/screens/novel/reader_screen.dart`
- Test: (verify analyze + thủ công)

**Interfaces:**
- Produces: đọc toàn màn hình — top bar tự dựng trượt cùng bottom; tap vùng giữa toggle `_chromeVisible`.

- [ ] **Step 1: Bỏ AppBar, dựng top-bar trong Stack**

Trong `build`, xoá `appBar:` của `Scaffold` (giữ `backgroundColor: bg`). Tạo helper top-bar:
```dart
  Widget _topBar(BuildContext context, Book book, Chapter ch, List<Chapter> chapters, bool locked, Color bg, Color ink) {
    return Container(
      color: bg,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: 52,
          child: Row(children: [
            IconButton(icon: Icon(Icons.arrow_back, color: ink), onPressed: () => context.pop()),
            Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(book.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 14, color: ink)),
              Text('Ch ${ch.n}/${chapters.length} · ${ch.title}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 11, color: ink.withValues(alpha: 0.6))),
            ])),
            IconButton(tooltip: 'Nghe', icon: Icon(Icons.headphones_outlined, color: ink), onPressed: locked ? null : () => _playChapterAudio(book, ch)),
            IconButton(tooltip: 'Đánh dấu', icon: Icon(_isBookmarkedHere ? Icons.bookmark : Icons.bookmark_border, color: ink), onPressed: _toggleBookmark),
            IconButton(tooltip: 'Tuỳ chỉnh đọc', icon: Text('Aa', style: AppType.serif(size: 18, w: FontWeight.w700, color: ink)), onPressed: _openSettings),
            IconButton(tooltip: 'Danh sách chương', icon: Icon(Icons.menu, color: ink), onPressed: () => _openChapterList(chapters)),
          ]),
        ),
      ),
    );
  }
```

- [ ] **Step 2: Body: tap-center + top-bar trượt trong Stack**

Trong `Scaffold.body: Stack(children: [...])`:
- Bọc phần nội dung đọc (ListView) bằng `GestureDetector(behavior: HitTestBehavior.translucent, onTap: () => setState(() => _chromeVisible = !_chromeVisible), child: <ListView>)`. Thêm `padding top` cho ListView để không bị top-bar che (đổi `EdgeInsets.fromLTRB(_marginH, 8, _marginH, 120)` → `EdgeInsets.fromLTRB(_marginH, 60, _marginH, 120)`).
- Thêm top-bar trượt (đầu Stack, trên cùng):
```dart
          Positioned(
            top: 0, left: 0, right: 0,
            child: AnimatedSlide(
              duration: const Duration(milliseconds: 220),
              offset: _chromeVisible ? Offset.zero : const Offset(0, -1),
              child: _topBar(context, book, ch, chapters, locked, bg, ink),
            ),
          ),
```
> Giữ nguyên khối bottom (`Positioned bottom` với read-along + `_readerNav`). `locked` state: top-bar vẫn hiện; panel khoá thay cho ListView.

- [ ] **Step 3: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib/screens/novel/reader_screen.dart` → No issues.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS.
Thủ công: tap vùng giữa → ẩn cả top+bottom (đọc toàn màn hình); tap lại → hiện; cuộn xuống ẩn, lên hiện vẫn hoạt động; nút top-bar (back/nghe/bookmark/Aa/list) chạy đúng.

- [ ] **Step 4: Commit**

```bash
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): sliding top bar + tap-center fullscreen toggle"
```

---

## Task 8: Wakelock + brightness in-app

**Files:**
- Modify: `lib/screens/novel/reader_screen.dart`
- Test: (verify analyze + thủ công trên máy)

**Interfaces:**
- Consumes: `wakelock_plus`, `screen_brightness` (Task 1 deps), `ReaderStore.readBrightness/saveBrightness`.
- Produces: giữ sáng khi ở Reader; slider brightness trong settings sheet, áp + lưu.

- [ ] **Step 1: Import + wakelock theo vòng đời**

Thêm imports:
```dart
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:screen_brightness/screen_brightness.dart';
```
Trong `initState` (cuối): `WakelockPlus.enable();` và áp brightness đã lưu:
```dart
    final b = _reader.readBrightness();
    if (b >= 0) { ScreenBrightness().setScreenBrightness(b); }
```
Trong `dispose()` (đầu): 
```dart
    WakelockPlus.disable();
    ScreenBrightness().resetScreenBrightness();
```
> Bọc mọi lời gọi screen_brightness bằng try/catch để không sập nếu plugin lỗi/không hỗ trợ (xem Step 2 helper).

- [ ] **Step 2: Helper set brightness an toàn**

Thêm:
```dart
  double _brightness = 1.0;

  Future<void> _applyBrightness(double v) async {
    _brightness = v;
    try { await ScreenBrightness().setScreenBrightness(v); } catch (_) {}
    _reader.saveBrightness(v);
  }
```
Trong `initState`, khởi tạo `_brightness` từ store nếu >=0:
```dart
    final bset = _reader.readBrightness();
    if (bset >= 0) _brightness = bset;
```
(gộp với Step 1: chỉ đọc store 1 lần.)

- [ ] **Step 3: Slider BRIGHTNESS trong settings sheet**

Trong `_openSettings`, sau mục MARGIN (cuối Column), thêm:
```dart
                label('BRIGHTNESS'),
                Row(children: [
                  Icon(Icons.brightness_low, size: 18, color: pal.muted),
                  Expanded(child: Slider(
                    value: _brightness.clamp(0.0, 1.0),
                    activeColor: AppPalette.terracotta,
                    onChanged: (v) => setSheet(() => _brightness = v),
                    onChangeEnd: (v) => _applyBrightness(v),
                  )),
                  Icon(Icons.brightness_high, size: 18, color: pal.muted),
                ]),
```
> Kéo mượt (setSheet cập nhật UI slider); áp + lưu khi thả (`onChangeEnd`).

- [ ] **Step 4: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze lib/screens/novel/reader_screen.dart` → No issues.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS.
Thủ công trên máy: vào Reader → màn không tự tắt; mở Aa → kéo Brightness → sáng màn đổi thật; thoát Reader → sáng trả về hệ thống; mở lại → giữ mức đã lưu.

- [ ] **Step 5: Commit**

```bash
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): keep-awake (wakelock) + in-app brightness slider"
```

---

## Task 9: Full verify + build lên máy

- [ ] **Step 1: Full test + analyze**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → tất cả PASS.
Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 error/warning (info-lint pre-existing chấp nhận).

- [ ] **Step 2: Build + cài máy test (verify tính năng thiết bị)**

Build: `& "D:\SetupC\flutter\bin\flutter.bat" build apk --release --dart-define=USE_BACKEND=true --dart-define=API_BASE_URL=https://api.dreamtap.me`
Cài: `<adb> -s BQLN4XOZKRW4QCEM install -r build\app\outputs\flutter-apk\app-release.apk`
Kịch bản: đổi settings → giữ sau khi thoát; đọc giữa chương → thoát → resume đúng chỗ; bookmark → nhảy đúng; thanh % chạy; tap giữa toàn màn hình; wakelock giữ sáng; brightness slider đổi sáng thật.

- [ ] **Step 3: Commit (nếu có chỉnh vặt)**

```bash
git add -A && git commit -m "test(reader): full suite green + manual device verify"
```

## Ghi chú
- `Color.value` deprecated ở Flutter mới → dùng `.toARGB32()`; nếu bản Flutter máy build không có, fallback `.value` (Task 3 Step 3).
- Nếu `flutter pub add` resolve version xung đột SDK → báo BLOCKED kèm log (không tự hạ SDK).
- Spec 3 (social) và Spec 2 (read-along) làm sau, không nằm trong plan này.
