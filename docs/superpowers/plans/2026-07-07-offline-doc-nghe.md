# Offline đọc & nghe (NovelVerse) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép đọc truyện + nghe audiobook offline (auto-cache khi đọc/nghe + tải cả truyện thủ công), kèm 2 cải tiến BookDetail (ẩn Listen khi không audio; danh sách chương lazy + nút thu gọn reveal-on-scroll-up).

**Architecture:** Thêm lớp `lib/data/offline/` (Hive metadata/text + FileStore audio + DownloadManager + ConnectivityService + OfflineNotifier) nằm giữa repository và nguồn dữ liệu. Repository đọc local-first khi đã tải hoặc offline. Không đụng `JsonCache`/`TokenStore`/luồng online.

**Tech Stack:** Flutter (Dart ^3.12.2), Hive (Map thuần, KHÔNG dùng TypeAdapter/build_runner), path_provider, connectivity_plus, dio (đã có), provider, go_router, just_audio.

## Global Constraints
- Dart SDK: `^3.12.2` (giữ nguyên `pubspec.yaml`).
- Chỉ chế độ **Novel** (text chương + audiobook MP3). KHÔNG offline Music/HLS.
- Hive lưu **Map thuần** (`Box` dynamic) — không sinh adapter, không thêm build_runner.
- Ngưỡng auto-cache mặc định: **`kMaxAutoCacheBytes = 200 * 1024 * 1024`**.
- File audio đặt tại `<AppDocuments>/offline/audio/<storyId>/<chapterId>.mp3`.
- Key xuyên suốt = `storyId`/`chapterId` (UUID từ BE).
- Không đụng `lib/data/cache/json_cache.dart`, `lib/api/token_store.dart`, luồng online hiện tại.
- Test: `flutter test`. Unit dùng `Hive.init(<tempDir>)`; FileStore/DownloadManager nhận thư mục/hàm tải **inject được** để test không chạm mạng/đĩa thật.

## File Structure

**Tạo mới:**
- `lib/data/offline/offline_models.dart` — `DownloadRecord`, `OfflineChapter`, `OfflineStoryMeta` (+ `toMap/fromMap`).
- `lib/data/offline/file_store.dart` — `FileStore` (đọc/ghi/xoá/size file audio).
- `lib/data/offline/offline_store.dart` — `OfflineStore` (Hive + FileStore facade, eviction).
- `lib/data/offline/connectivity_service.dart` — `ConnectivityService`.
- `lib/data/offline/download_manager.dart` — `DownloadManager` + `OfflineNotifier` state tải.
- `lib/screens/downloads/downloads_screen.dart` — màn "Đã tải".
- `lib/widgets/offline_banner.dart` — banner offline.
- `test/offline/file_store_test.dart`, `test/offline/offline_store_test.dart`, `test/offline/eviction_test.dart`, `test/offline/download_manager_test.dart`, `test/data/chapter_mapper_test.dart`, `test/data/stories_repository_offline_test.dart`, `test/screens/book_detail_listen_test.dart`.

**Sửa:**
- `lib/models/models.dart` — thêm `Chapter.hasAudio`.
- `lib/data/mappers/chapter_mapper.dart` — map `hasAudio`.
- `lib/data/repositories/stories_repository.dart` — local-first + auto-cache.
- `lib/main.dart` — init Hive + provide offline services.
- `lib/router.dart` — route `/downloads`.
- `lib/screens/novel/book_detail_screen.dart` — Listen có điều kiện, nút tải, chapter list sliver/lazy/reveal.
- `lib/screens/profile_screen.dart` — entry vào `/downloads`.
- `lib/screens/app_shell.dart` — chèn `OfflineBanner`.
- `pubspec.yaml` — thêm gói.

---

## Task 1: Thêm dependency + models offline

**Files:**
- Modify: `pubspec.yaml:40-45` (mục `dependencies`)
- Create: `lib/data/offline/offline_models.dart`
- Test: (không — task cấu hình + data class thuần, được test gián tiếp ở Task 3)

**Interfaces:**
- Produces:
  - `class DownloadRecord { String storyId, slug, title, cover, author, language, kind /*'downloaded'|'auto'*/, status /*'pending'|'downloading'|'complete'|'failed'|'paused'*/; int totalChapters, savedChapters, bytesText, bytesAudio, createdAt, lastAccessAt; Map<String,dynamic> toMap(); factory DownloadRecord.fromMap(Map); DownloadRecord copyWith({...}); }`
  - `class OfflineChapter { String chapterId, storyId, title; int n; String content; String? audioFile; bool hasAudio; Map toMap(); factory fromMap(Map); }`
  - `class OfflineStoryMeta { String storyId, synopsis, cover, author, subtitle, status, genre, trope, rating, reads; int unlockPrice, discountPercent, totalChapters; List<Map> chapters /*{chapterId,n,title,state,hasAudio}*/; Map toMap(); factory fromMap(Map); }`

- [ ] **Step 1: Thêm gói vào `pubspec.yaml`** (ngay dưới `dio: ^5.7.0`, giữ thụt lề 2 space)

```yaml
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  path_provider: ^2.1.4
  connectivity_plus: ^6.0.5
```

- [ ] **Step 2: Chạy pub get**

Run: `flutter pub get`
Expected: "Got dependencies!" (không lỗi resolve).

- [ ] **Step 3: Viết `offline_models.dart`** (data class thuần + Map hoá; không phụ thuộc Flutter)

```dart
/// Bản ghi 1 truyện trong sổ đăng ký offline (Hive box `downloads`).
class DownloadRecord {
  const DownloadRecord({
    required this.storyId,
    required this.slug,
    required this.title,
    required this.cover,
    required this.author,
    required this.language,
    required this.kind, // 'downloaded' | 'auto'
    required this.status, // 'pending'|'downloading'|'complete'|'failed'|'paused'
    required this.totalChapters,
    required this.savedChapters,
    required this.bytesText,
    required this.bytesAudio,
    required this.createdAt,
    required this.lastAccessAt,
  });

  final String storyId, slug, title, cover, author, language, kind, status;
  final int totalChapters, savedChapters, bytesText, bytesAudio, createdAt, lastAccessAt;

  int get totalBytes => bytesText + bytesAudio;

  DownloadRecord copyWith({
    String? kind,
    String? status,
    int? totalChapters,
    int? savedChapters,
    int? bytesText,
    int? bytesAudio,
    int? lastAccessAt,
  }) =>
      DownloadRecord(
        storyId: storyId,
        slug: slug,
        title: title,
        cover: cover,
        author: author,
        language: language,
        kind: kind ?? this.kind,
        status: status ?? this.status,
        totalChapters: totalChapters ?? this.totalChapters,
        savedChapters: savedChapters ?? this.savedChapters,
        bytesText: bytesText ?? this.bytesText,
        bytesAudio: bytesAudio ?? this.bytesAudio,
        createdAt: createdAt,
        lastAccessAt: lastAccessAt ?? this.lastAccessAt,
      );

  Map<String, dynamic> toMap() => {
        'storyId': storyId, 'slug': slug, 'title': title, 'cover': cover,
        'author': author, 'language': language, 'kind': kind, 'status': status,
        'totalChapters': totalChapters, 'savedChapters': savedChapters,
        'bytesText': bytesText, 'bytesAudio': bytesAudio,
        'createdAt': createdAt, 'lastAccessAt': lastAccessAt,
      };

  factory DownloadRecord.fromMap(Map map) {
    int i(dynamic v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0);
    String s(dynamic v) => (v ?? '').toString();
    return DownloadRecord(
      storyId: s(map['storyId']), slug: s(map['slug']), title: s(map['title']),
      cover: s(map['cover']), author: s(map['author']), language: s(map['language']),
      kind: s(map['kind']).isEmpty ? 'auto' : s(map['kind']),
      status: s(map['status']).isEmpty ? 'complete' : s(map['status']),
      totalChapters: i(map['totalChapters']), savedChapters: i(map['savedChapters']),
      bytesText: i(map['bytesText']), bytesAudio: i(map['bytesAudio']),
      createdAt: i(map['createdAt']), lastAccessAt: i(map['lastAccessAt']),
    );
  }
}

/// Nội dung text 1 chương (Hive box `chapters`).
class OfflineChapter {
  const OfflineChapter({
    required this.chapterId,
    required this.storyId,
    required this.n,
    required this.title,
    required this.content,
    required this.hasAudio,
    this.audioFile,
  });

  final String chapterId, storyId, title, content;
  final int n;
  final bool hasAudio;
  final String? audioFile;

  OfflineChapter copyWith({String? audioFile}) => OfflineChapter(
        chapterId: chapterId, storyId: storyId, n: n, title: title,
        content: content, hasAudio: hasAudio, audioFile: audioFile ?? this.audioFile,
      );

  Map<String, dynamic> toMap() => {
        'chapterId': chapterId, 'storyId': storyId, 'n': n, 'title': title,
        'content': content, 'hasAudio': hasAudio, 'audioFile': audioFile,
      };

  factory OfflineChapter.fromMap(Map map) => OfflineChapter(
        chapterId: (map['chapterId'] ?? '').toString(),
        storyId: (map['storyId'] ?? '').toString(),
        n: map['n'] is int ? map['n'] : int.tryParse('${map['n']}') ?? 0,
        title: (map['title'] ?? '').toString(),
        content: (map['content'] ?? '').toString(),
        hasAudio: map['hasAudio'] == true,
        audioFile: map['audioFile'] as String?,
      );
}

/// Chi tiết truyện đủ để dựng BookDetail/Reader offline (Hive box `storyMeta`).
class OfflineStoryMeta {
  const OfflineStoryMeta({
    required this.storyId,
    required this.synopsis,
    required this.cover,
    required this.author,
    required this.subtitle,
    required this.status,
    required this.genre,
    required this.trope,
    required this.rating,
    required this.reads,
    required this.unlockPrice,
    required this.discountPercent,
    required this.totalChapters,
    required this.chapters,
  });

  final String storyId, synopsis, cover, author, subtitle, status, genre, trope, rating, reads;
  final int unlockPrice, discountPercent, totalChapters;
  final List<Map> chapters; // {chapterId,n,title,state,hasAudio}

  Map<String, dynamic> toMap() => {
        'storyId': storyId, 'synopsis': synopsis, 'cover': cover, 'author': author,
        'subtitle': subtitle, 'status': status, 'genre': genre, 'trope': trope,
        'rating': rating, 'reads': reads, 'unlockPrice': unlockPrice,
        'discountPercent': discountPercent, 'totalChapters': totalChapters,
        'chapters': chapters,
      };

  factory OfflineStoryMeta.fromMap(Map map) {
    int i(dynamic v) => v is int ? v : int.tryParse('${v ?? ''}') ?? 0;
    return OfflineStoryMeta(
      storyId: (map['storyId'] ?? '').toString(),
      synopsis: (map['synopsis'] ?? '').toString(),
      cover: (map['cover'] ?? '').toString(),
      author: (map['author'] ?? '').toString(),
      subtitle: (map['subtitle'] ?? '').toString(),
      status: (map['status'] ?? '').toString(),
      genre: (map['genre'] ?? '').toString(),
      trope: (map['trope'] ?? '').toString(),
      rating: (map['rating'] ?? '').toString(),
      reads: (map['reads'] ?? '').toString(),
      unlockPrice: i(map['unlockPrice']),
      discountPercent: i(map['discountPercent']),
      totalChapters: i(map['totalChapters']),
      chapters: (map['chapters'] as List? ?? const []).cast<Map>(),
    );
  }
}
```

- [ ] **Step 4: Kiểm tra compile**

Run: `flutter analyze lib/data/offline/offline_models.dart`
Expected: "No issues found!"

- [ ] **Step 5: Commit**

```bash
git add pubspec.yaml pubspec.lock lib/data/offline/offline_models.dart
git commit -m "feat(offline): add deps + offline data models"
```
> Nếu novelverse chưa phải git repo: bỏ qua các bước commit toàn plan, hoặc `git init` một lần ở đầu (xem ghi chú cuối).

---

## Task 2: FileStore (đọc/ghi/xoá file audio)

**Files:**
- Create: `lib/data/offline/file_store.dart`
- Test: `test/offline/file_store_test.dart`

**Interfaces:**
- Consumes: (none)
- Produces:
  - `class FileStore { FileStore(Directory baseDir); static Future<FileStore> open(); String audioPath(String storyId, String chapterId); Future<bool> audioExists(String storyId, String chapterId); Future<int> writeAudioBytes(String storyId, String chapterId, List<int> bytes); Future<int> audioSize(String storyId, String chapterId); Future<void> deleteStory(String storyId); }`
  - `audioPath` trả path tuyệt đối `<base>/audio/<storyId>/<chapterId>.mp3`.

- [ ] **Step 1: Viết test thất bại**

```dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/offline/file_store.dart';

void main() {
  late Directory tmp;
  late FileStore fs;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('fs_test');
    fs = FileStore(tmp);
  });
  tearDown(() async { if (tmp.existsSync()) await tmp.delete(recursive: true); });

  test('writeAudioBytes tạo file, audioExists true, size đúng, deleteStory xoá', () async {
    expect(await fs.audioExists('s1', 'c1'), false);
    final n = await fs.writeAudioBytes('s1', 'c1', List.filled(2048, 7));
    expect(n, 2048);
    expect(await fs.audioExists('s1', 'c1'), true);
    expect(await fs.audioSize('s1', 'c1'), 2048);
    expect(fs.audioPath('s1', 'c1').endsWith('audio/s1/c1.mp3'.replaceAll('/', Platform.pathSeparator)), true);
    await fs.deleteStory('s1');
    expect(await fs.audioExists('s1', 'c1'), false);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `flutter test test/offline/file_store_test.dart`
Expected: FAIL ("Target of URI doesn't exist" / FileStore chưa có).

- [ ] **Step 3: Viết `file_store.dart`**

```dart
import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Quản lý file audio offline dưới `<baseDir>/audio/<storyId>/<chapterId>.mp3`.
/// Nhận [baseDir] để test inject thư mục tạm.
class FileStore {
  FileStore(this._base);
  final Directory _base;

  static Future<FileStore> open() async {
    final docs = await getApplicationDocumentsDirectory();
    return FileStore(Directory('${docs.path}/offline'));
  }

  File _audio(String storyId, String chapterId) =>
      File('${_base.path}/audio/$storyId/$chapterId.mp3');

  String audioPath(String storyId, String chapterId) => _audio(storyId, chapterId).path;

  Future<bool> audioExists(String storyId, String chapterId) =>
      _audio(storyId, chapterId).exists();

  Future<int> writeAudioBytes(String storyId, String chapterId, List<int> bytes) async {
    final f = _audio(storyId, chapterId);
    await f.parent.create(recursive: true);
    await f.writeAsBytes(bytes, flush: true);
    return bytes.length;
  }

  Future<int> audioSize(String storyId, String chapterId) async {
    final f = _audio(storyId, chapterId);
    return await f.exists() ? f.length() : 0;
  }

  Future<void> deleteStory(String storyId) async {
    final dir = Directory('${_base.path}/audio/$storyId');
    if (await dir.exists()) await dir.delete(recursive: true);
  }
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `flutter test test/offline/file_store_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/offline/file_store.dart test/offline/file_store_test.dart
git commit -m "feat(offline): FileStore for audio files"
```

---

## Task 3: OfflineStore (Hive facade)

**Files:**
- Create: `lib/data/offline/offline_store.dart`
- Test: `test/offline/offline_store_test.dart`

**Interfaces:**
- Consumes: `FileStore` (Task 2), models (Task 1).
- Produces:
  - `class OfflineStore { OfflineStore({required Box downloads, required Box chapters, required Box storyMeta, required FileStore files}); DownloadRecord? download(String storyId); List<DownloadRecord> listDownloads(); Future<void> upsertDownload(DownloadRecord r); Future<void> touch(String storyId, int nowMs); bool hasChapter(String chapterId); OfflineChapter? readChapter(String chapterId); Future<void> saveChapter(OfflineChapter c); OfflineStoryMeta? readStoryMeta(String storyId); Future<void> saveStoryMeta(OfflineStoryMeta m); String? audioPath(String storyId, String chapterId); Future<void> deleteStory(String storyId); int totalBytes(String kind); }`

- [ ] **Step 1: Viết test thất bại**

```dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';

void main() {
  late Directory tmp;
  late OfflineStore store;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('os_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp),
    );
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('save/read chapter round-trip', () async {
    await store.saveChapter(const OfflineChapter(
      chapterId: 'c1', storyId: 's1', n: 1, title: 'Ch1', content: 'noi dung', hasAudio: true));
    expect(store.hasChapter('c1'), true);
    expect(store.readChapter('c1')!.content, 'noi dung');
  });

  test('upsert + list downloads, totalBytes theo kind', () async {
    await store.upsertDownload(DownloadRecord(
      storyId: 's1', slug: 'a', title: 'A', cover: '', author: '', language: 'vi',
      kind: 'downloaded', status: 'complete', totalChapters: 2, savedChapters: 2,
      bytesText: 100, bytesAudio: 900, createdAt: 1, lastAccessAt: 1));
    await store.upsertDownload(DownloadRecord(
      storyId: 's2', slug: 'b', title: 'B', cover: '', author: '', language: 'vi',
      kind: 'auto', status: 'complete', totalChapters: 1, savedChapters: 1,
      bytesText: 10, bytesAudio: 40, createdAt: 1, lastAccessAt: 1));
    expect(store.listDownloads().length, 2);
    expect(store.totalBytes('downloaded'), 1000);
    expect(store.totalBytes('auto'), 50);
  });

  test('deleteStory xoá record + chapter', () async {
    await store.upsertDownload(DownloadRecord(
      storyId: 's1', slug: 'a', title: 'A', cover: '', author: '', language: 'vi',
      kind: 'downloaded', status: 'complete', totalChapters: 1, savedChapters: 1,
      bytesText: 1, bytesAudio: 1, createdAt: 1, lastAccessAt: 1));
    await store.saveChapter(const OfflineChapter(
      chapterId: 'c1', storyId: 's1', n: 1, title: 'x', content: 'y', hasAudio: false));
    await store.deleteStory('s1');
    expect(store.download('s1'), null);
    expect(store.hasChapter('c1'), false);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `flutter test test/offline/offline_store_test.dart`
Expected: FAIL (OfflineStore chưa có).

- [ ] **Step 3: Viết `offline_store.dart`**

```dart
import 'package:hive/hive.dart';

import 'file_store.dart';
import 'offline_models.dart';

/// Facade lưu trữ offline: metadata + text (Hive) và file audio (FileStore).
class OfflineStore {
  OfflineStore({
    required Box downloads,
    required Box chapters,
    required Box storyMeta,
    required FileStore files,
  })  : _downloads = downloads,
        _chapters = chapters,
        _storyMeta = storyMeta,
        _files = files;

  final Box _downloads, _chapters, _storyMeta;
  final FileStore _files;

  // ── downloads registry ──
  DownloadRecord? download(String storyId) {
    final m = _downloads.get(storyId);
    return m is Map ? DownloadRecord.fromMap(m) : null;
  }

  List<DownloadRecord> listDownloads() => _downloads.values
      .whereType<Map>()
      .map(DownloadRecord.fromMap)
      .toList();

  Future<void> upsertDownload(DownloadRecord r) =>
      _downloads.put(r.storyId, r.toMap());

  Future<void> touch(String storyId, int nowMs) async {
    final r = download(storyId);
    if (r != null) await upsertDownload(r.copyWith(lastAccessAt: nowMs));
  }

  int totalBytes(String kind) => listDownloads()
      .where((r) => r.kind == kind)
      .fold(0, (sum, r) => sum + r.totalBytes);

  // ── chapters ──
  bool hasChapter(String chapterId) => _chapters.containsKey(chapterId);

  OfflineChapter? readChapter(String chapterId) {
    final m = _chapters.get(chapterId);
    return m is Map ? OfflineChapter.fromMap(m) : null;
  }

  Future<void> saveChapter(OfflineChapter c) => _chapters.put(c.chapterId, c.toMap());

  // ── story meta ──
  OfflineStoryMeta? readStoryMeta(String storyId) {
    final m = _storyMeta.get(storyId);
    return m is Map ? OfflineStoryMeta.fromMap(m) : null;
  }

  Future<void> saveStoryMeta(OfflineStoryMeta m) => _storyMeta.put(m.storyId, m.toMap());

  // ── audio ──
  String? audioPath(String storyId, String chapterId) {
    final ch = readChapter(chapterId);
    if (ch?.audioFile == null) return null;
    return _files.audioPath(storyId, chapterId);
  }

  // ── delete ──
  Future<void> deleteStory(String storyId) async {
    final meta = readStoryMeta(storyId);
    final chapterIds = <String>[
      ...(_chapters.values.whereType<Map>().where((m) => m['storyId'] == storyId).map((m) => (m['chapterId'] ?? '').toString())),
      ...?meta?.chapters.map((c) => (c['chapterId'] ?? '').toString()),
    ];
    for (final id in chapterIds.toSet()) {
      await _chapters.delete(id);
    }
    await _storyMeta.delete(storyId);
    await _downloads.delete(storyId);
    await _files.deleteStory(storyId);
  }
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `flutter test test/offline/offline_store_test.dart`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add lib/data/offline/offline_store.dart test/offline/offline_store_test.dart
git commit -m "feat(offline): OfflineStore Hive facade"
```

---

## Task 4: Eviction LRU + promote auto→downloaded

**Files:**
- Modify: `lib/data/offline/offline_store.dart` (thêm 2 method)
- Test: `test/offline/eviction_test.dart`

**Interfaces:**
- Produces (thêm vào `OfflineStore`):
  - `Future<void> enforceAutoCacheLimit(int maxBytes);` — xoá dần record `kind:'auto'` có `lastAccessAt` nhỏ nhất tới khi `totalBytes('auto') <= maxBytes`.
  - `Future<void> promoteToDownloaded(String storyId);` — đổi `kind` record thành `'downloaded'`.

- [ ] **Step 1: Viết test thất bại**

```dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';

DownloadRecord rec(String id, String kind, int bytes, int last) => DownloadRecord(
    storyId: id, slug: id, title: id, cover: '', author: '', language: 'vi',
    kind: kind, status: 'complete', totalChapters: 1, savedChapters: 1,
    bytesText: 0, bytesAudio: bytes, createdAt: 0, lastAccessAt: last);

void main() {
  late Directory tmp; late OfflineStore store;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('ev_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp));
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('eviction xoá auto cũ nhất trước, giữ downloaded', () async {
    await store.upsertDownload(rec('old', 'auto', 100, 1));   // cũ nhất
    await store.upsertDownload(rec('new', 'auto', 100, 9));
    await store.upsertDownload(rec('keep', 'downloaded', 100, 0)); // không bị xoá
    await store.enforceAutoCacheLimit(150); // auto=200 > 150 → xoá 'old'
    expect(store.download('old'), null);
    expect(store.download('new') != null, true);
    expect(store.download('keep') != null, true);
    expect(store.totalBytes('auto') <= 150, true);
  });

  test('promoteToDownloaded bảo vệ khỏi eviction', () async {
    await store.upsertDownload(rec('s1', 'auto', 100, 1));
    await store.promoteToDownloaded('s1');
    expect(store.download('s1')!.kind, 'downloaded');
    await store.enforceAutoCacheLimit(0);
    expect(store.download('s1') != null, true); // downloaded → không xoá
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `flutter test test/offline/eviction_test.dart`
Expected: FAIL (method chưa có).

- [ ] **Step 3: Thêm method vào `offline_store.dart`** (ngay trước `deleteStory`)

```dart
  /// Xoá dần record 'auto' cũ nhất (lastAccess nhỏ nhất) tới khi dưới ngưỡng.
  Future<void> enforceAutoCacheLimit(int maxBytes) async {
    var autos = listDownloads().where((r) => r.kind == 'auto').toList()
      ..sort((a, b) => a.lastAccessAt.compareTo(b.lastAccessAt));
    var total = autos.fold(0, (s, r) => s + r.totalBytes);
    for (final r in autos) {
      if (total <= maxBytes) break;
      await deleteStory(r.storyId);
      total -= r.totalBytes;
    }
  }

  /// Nâng 1 truyện auto-cache lên 'downloaded' (không bị eviction).
  Future<void> promoteToDownloaded(String storyId) async {
    final r = download(storyId);
    if (r != null && r.kind != 'downloaded') {
      await upsertDownload(r.copyWith(kind: 'downloaded'));
    }
  }
```

- [ ] **Step 4: Chạy test → PASS**

Run: `flutter test test/offline/eviction_test.dart`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add lib/data/offline/offline_store.dart test/offline/eviction_test.dart
git commit -m "feat(offline): LRU eviction + promote auto to downloaded"
```

---

## Task 5: ConnectivityService

**Files:**
- Create: `lib/data/offline/connectivity_service.dart`
- Test: (tối thiểu — logic mỏng bọc plugin; test set/notify thủ công)
- Test: `test/offline/connectivity_test.dart`

**Interfaces:**
- Produces: `class ConnectivityService extends ChangeNotifier { bool get isOnline; @visibleForTesting void setOnline(bool v); Future<void> start(); }`

- [ ] **Step 1: Viết test thất bại**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/offline/connectivity_service.dart';

void main() {
  test('setOnline cập nhật + notify', () {
    final c = ConnectivityService();
    var notified = 0;
    c.addListener(() => notified++);
    expect(c.isOnline, true); // mặc định coi như online
    c.setOnline(false);
    expect(c.isOnline, false);
    expect(notified, 1);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `flutter test test/offline/connectivity_test.dart`
Expected: FAIL.

- [ ] **Step 3: Viết `connectivity_service.dart`**

```dart
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Trạng thái online/offline. Mặc định coi là online tới khi plugin báo khác.
class ConnectivityService extends ChangeNotifier {
  bool _online = true;
  bool get isOnline => _online;

  @visibleForTesting
  void setOnline(bool v) {
    if (_online == v) return;
    _online = v;
    notifyListeners();
  }

  Future<void> start() async {
    final c = Connectivity();
    void apply(List<ConnectivityResult> r) =>
        setOnline(r.any((x) => x != ConnectivityResult.none));
    apply(await c.checkConnectivity());
    c.onConnectivityChanged.listen(apply);
  }
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `flutter test test/offline/connectivity_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/offline/connectivity_service.dart test/offline/connectivity_test.dart
git commit -m "feat(offline): ConnectivityService"
```

---

## Task 6: DownloadManager + OfflineNotifier

**Files:**
- Create: `lib/data/offline/download_manager.dart`
- Test: `test/offline/download_manager_test.dart`

**Interfaces:**
- Consumes: `OfflineStore` (Task 3-4), `StoriesRepository` (`detail`, `chapterContent`), `AudioRepository` (`chapterAudioUrl`), `FileStore`.
- Produces:
  - `typedef FileDownloader = Future<int> Function(String url, String storyId, String chapterId);` (trả bytes đã ghi)
  - `class DownloadManager extends ChangeNotifier { DownloadManager(this._stories, this._audio, this._store, {required FileDownloader downloader, int nowMs()?}); Map<String, DownloadProgress> get progress; Future<void> downloadStory(String storyId); void cancel(String storyId); }`
  - `class DownloadProgress { final int total, done; final String status; double get fraction; }`
- Ghi chú: `downloader` inject để test không chạm mạng; bản thật dùng `dio.download` ghi vào `FileStore.audioPath`.

- [ ] **Step 1: Viết test thất bại** (dùng fake repo + downloader trong bộ nhớ)

```dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/download_manager.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';
import 'package:novelverse/models/models.dart';

// Fake repo trả 2 chương: c1 có audio, c2 không.
class FakeStories implements StoriesRepositoryLike {
  @override
  Future<StoryDetailData> detailData(String id) async => StoryDetailData(
      storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A', language: 'vi',
      synopsis: '', subtitle: '', status: 'ongoing', genre: '', trope: '',
      rating: '5', reads: '1', unlockPrice: 0, discountPercent: 0,
      chapters: const [
        ChapterMeta(chapterId: 'c1', n: 1, title: 'C1', state: 'free', hasAudio: true),
        ChapterMeta(chapterId: 'c2', n: 2, title: 'C2', state: 'free', hasAudio: false),
      ]);
  @override
  Future<String> chapterText(String id) async => 'text-$id';
}

class FakeAudio implements AudioUrlResolver {
  @override
  Future<String?> chapterAudioUrl(String id, {String? variantId}) async => 'http://x/$id.mp3';
}

void main() {
  late Directory tmp; late OfflineStore store; late DownloadManager dm;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('dm_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp));
    dm = DownloadManager(FakeStories(), FakeAudio(), store,
        downloader: (url, s, c) async => 500, nowMs: () => 123);
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('downloadStory lưu đủ chương, chỉ tải audio chương hasAudio', () async {
    await dm.downloadStory('s1');
    expect(store.readChapter('c1')!.content, 'text-c1');
    expect(store.readChapter('c1')!.audioFile != null, true);   // c1 có audio
    expect(store.readChapter('c2')!.audioFile, null);           // c2 không
    final r = store.download('s1')!;
    expect(r.status, 'complete');
    expect(r.savedChapters, 2);
    expect(r.kind, 'downloaded');
    expect(r.bytesAudio, 500);
  });
}
```
> Ghi chú thiết kế: để DownloadManager test được mà không cứng phụ thuộc lớp `StoriesRepository` cụ thể, Task 6 định nghĩa interface hẹp `StoriesRepositoryLike`/`AudioUrlResolver` và các struct `StoryDetailData`/`ChapterMeta`. Task 9 sẽ cho `StoriesRepository` implement `StoriesRepositoryLike`.

- [ ] **Step 2: Chạy test → FAIL**

Run: `flutter test test/offline/download_manager_test.dart`
Expected: FAIL (chưa có DownloadManager + interface).

- [ ] **Step 3: Viết `download_manager.dart`**

```dart
import 'package:flutter/foundation.dart';

import 'offline_store.dart';
import 'offline_models.dart';

/// Metadata 1 chương (đủ để tải + dựng meta). Do repository cung cấp.
class ChapterMeta {
  const ChapterMeta({required this.chapterId, required this.n, required this.title, required this.state, required this.hasAudio});
  final String chapterId, title, state;
  final int n;
  final bool hasAudio;
  Map<String, dynamic> toMap() => {'chapterId': chapterId, 'n': n, 'title': title, 'state': state, 'hasAudio': hasAudio};
}

/// Chi tiết truyện phẳng cho tải offline.
class StoryDetailData {
  const StoryDetailData({
    required this.storyId, required this.slug, required this.title, required this.cover,
    required this.author, required this.language, required this.synopsis, required this.subtitle,
    required this.status, required this.genre, required this.trope, required this.rating,
    required this.reads, required this.unlockPrice, required this.discountPercent, required this.chapters});
  final String storyId, slug, title, cover, author, language, synopsis, subtitle, status, genre, trope, rating, reads;
  final int unlockPrice, discountPercent;
  final List<ChapterMeta> chapters;
}

abstract class StoriesRepositoryLike {
  Future<StoryDetailData> detailData(String storyIdOrSlug);
  Future<String> chapterText(String chapterId);
}

abstract class AudioUrlResolver {
  Future<String?> chapterAudioUrl(String chapterId, {String? variantId});
}

/// Ghi file audio về đĩa; trả số byte. Bản thật dùng dio.download.
typedef FileDownloader = Future<int> Function(String url, String storyId, String chapterId);

class DownloadProgress {
  const DownloadProgress(this.done, this.total, this.status);
  final int done, total;
  final String status; // 'downloading'|'complete'|'failed'
  double get fraction => total == 0 ? 0 : done / total;
}

class DownloadManager extends ChangeNotifier {
  DownloadManager(this._stories, this._audio, this._store,
      {required FileDownloader downloader, int Function()? nowMs})
      : _download = downloader,
        _now = nowMs ?? (() => DateTime.now().millisecondsSinceEpoch);

  final StoriesRepositoryLike _stories;
  final AudioUrlResolver _audio;
  final OfflineStore _store;
  final FileDownloader _download;
  final int Function() _now;

  final Map<String, DownloadProgress> _progress = {};
  final Set<String> _cancelled = {};
  Map<String, DownloadProgress> get progress => Map.unmodifiable(_progress);

  void cancel(String storyId) => _cancelled.add(storyId);

  Future<void> downloadStory(String storyId) async {
    _cancelled.remove(storyId);
    final detail = await _stories.detailData(storyId);
    final total = detail.chapters.length;
    _set(storyId, DownloadProgress(0, total, 'downloading'));

    await _store.saveStoryMeta(OfflineStoryMeta(
      storyId: detail.storyId, synopsis: detail.synopsis, cover: detail.cover,
      author: detail.author, subtitle: detail.subtitle, status: detail.status,
      genre: detail.genre, trope: detail.trope, rating: detail.rating, reads: detail.reads,
      unlockPrice: detail.unlockPrice, discountPercent: detail.discountPercent,
      totalChapters: total, chapters: detail.chapters.map((c) => c.toMap()).toList()));

    var record = DownloadRecord(
      storyId: detail.storyId, slug: detail.slug, title: detail.title, cover: detail.cover,
      author: detail.author, language: detail.language, kind: 'downloaded',
      status: 'downloading', totalChapters: total, savedChapters: 0,
      bytesText: 0, bytesAudio: 0, createdAt: _now(), lastAccessAt: _now());
    await _store.upsertDownload(record);

    var saved = 0, bytesText = 0, bytesAudio = 0, failed = 0;
    for (final ch in detail.chapters) {
      if (_cancelled.contains(storyId)) {
        await _store.deleteStory(storyId);
        _progress.remove(storyId);
        notifyListeners();
        return;
      }
      try {
        final text = await _stories.chapterText(ch.chapterId);
        String? audioFile;
        if (ch.hasAudio) {
          final url = await _audio.chapterAudioUrl(ch.chapterId);
          if (url != null && url.isNotEmpty) {
            final n = await _download(url, detail.storyId, ch.chapterId);
            bytesAudio += n;
            audioFile = '${ch.chapterId}.mp3';
          }
        }
        bytesText += text.length;
        await _store.saveChapter(OfflineChapter(
          chapterId: ch.chapterId, storyId: detail.storyId, n: ch.n, title: ch.title,
          content: text, hasAudio: ch.hasAudio, audioFile: audioFile));
        saved++;
      } catch (_) {
        failed++;
      }
      record = record.copyWith(savedChapters: saved, bytesText: bytesText, bytesAudio: bytesAudio);
      await _store.upsertDownload(record);
      _set(storyId, DownloadProgress(saved, total, 'downloading'));
    }

    final status = failed == 0 ? 'complete' : 'failed';
    await _store.upsertDownload(record.copyWith(status: status, lastAccessAt: _now()));
    _set(storyId, DownloadProgress(saved, total, status));
  }

  void _set(String storyId, DownloadProgress p) {
    _progress[storyId] = p;
    notifyListeners();
  }
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `flutter test test/offline/download_manager_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/offline/download_manager.dart test/offline/download_manager_test.dart
git commit -m "feat(offline): DownloadManager download whole story"
```

---

## Task 7: `Chapter.hasAudio` (model + mapper)

**Files:**
- Modify: `lib/models/models.dart:44-57`
- Modify: `lib/data/mappers/chapter_mapper.dart:9-18`
- Test: `test/data/chapter_mapper_test.dart`

**Interfaces:**
- Produces: `Chapter.hasAudio` (bool, default false). `ChapterMapper.fromJson` set `hasAudio = (audioDuration>0) || hlsUrl.isNotEmpty`.

- [ ] **Step 1: Viết test thất bại**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/mappers/chapter_mapper.dart';

void main() {
  test('hasAudio true khi audioDuration>0', () {
    final c = ChapterMapper.fromJson({'id': 'c1', 'chapterNumber': 1, 'title': 't', 'accessType': 'free', 'audioDuration': 120});
    expect(c.hasAudio, true);
  });
  test('hasAudio true khi có hlsUrl', () {
    final c = ChapterMapper.fromJson({'id': 'c1', 'title': 't', 'accessType': 'free', 'hlsUrl': 'http://x.m3u8'});
    expect(c.hasAudio, true);
  });
  test('hasAudio false khi không audio', () {
    final c = ChapterMapper.fromJson({'id': 'c1', 'title': 't', 'accessType': 'free'});
    expect(c.hasAudio, false);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `flutter test test/data/chapter_mapper_test.dart`
Expected: FAIL (`hasAudio` chưa có).

- [ ] **Step 3a: Thêm field vào `models.dart`** — sửa constructor + field của `Chapter`:

```dart
class Chapter {
  const Chapter({required this.n, required this.title, required this.state, this.price = 15, this.id = '', this.hlsUrl = '', this.hasAudio = false});

  final String id;
  final int n;
  final String title;
  final ChapterState state;
  final int price;
  final String hlsUrl;

  /// True nếu chương có audiobook (audioDuration>0 hoặc có hlsUrl).
  final bool hasAudio;
}
```

- [ ] **Step 3b: Map trong `chapter_mapper.dart`** — sửa `fromJson`:

```dart
  static Chapter fromJson(Map<String, dynamic> j) {
    final dur = _asInt(j['audioDuration']);
    final hls = (j['hlsUrl'] ?? '').toString();
    return Chapter(
      id: (j['id'] ?? '').toString(),
      n: _asInt(j['chapterNumber']),
      title: (j['title'] ?? '').toString(),
      state: accessTypeToState((j['accessType'] ?? 'free').toString()),
      price: _asInt(j['unlockPrice'], fallback: 15),
      hlsUrl: hls,
      hasAudio: dur > 0 || hls.isNotEmpty,
    );
  }
```

- [ ] **Step 4: Chạy test → PASS**

Run: `flutter test test/data/chapter_mapper_test.dart`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add lib/models/models.dart lib/data/mappers/chapter_mapper.dart test/data/chapter_mapper_test.dart
git commit -m "feat(model): Chapter.hasAudio from audioDuration/hlsUrl"
```

---

## Task 8: StoriesRepository local-first + adapter cho DownloadManager

**Files:**
- Modify: `lib/data/repositories/stories_repository.dart`
- Test: `test/data/stories_repository_offline_test.dart`

**Interfaces:**
- Consumes: `OfflineStore`, `ConnectivityService`, `DownloadManager` interfaces (`StoriesRepositoryLike`, `StoryDetailData`, `ChapterMeta`).
- Produces:
  - Ctor mới: `StoriesRepository(this._api, [this._cache, this._offline, this._connectivity])`.
  - `chapterContent(id)` đọc local nếu `hasChapter(id) && (đã downloaded || offline)`, else API rồi auto-cache text.
  - `implements StoriesRepositoryLike`: `detailData(id)` (map từ `detail()`), `chapterText(id)` (= nội dung text, không cache side-effect).

- [ ] **Step 1: Viết test thất bại** (offline → trả local, không gọi API)

```dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';
import 'package:novelverse/data/offline/connectivity_service.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';

void main() {
  late Directory tmp; late OfflineStore store; late ConnectivityService conn;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('repo_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
      downloads: await Hive.openBox('downloads'),
      chapters: await Hive.openBox('chapters'),
      storyMeta: await Hive.openBox('storyMeta'),
      files: FileStore(tmp));
    conn = ConnectivityService()..setOnline(false);
    await store.saveChapter(const OfflineChapter(
      chapterId: 'c1', storyId: 's1', n: 1, title: 't', content: 'LOCAL', hasAudio: false));
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('offline + có local → trả text local, không cần API', () async {
    // ApiClient với baseUrl không tồn tại: nếu gọi mạng sẽ ném; test đảm bảo KHÔNG gọi.
    final repo = StoriesRepository(ApiClient(), null, store, conn);
    final c = await repo.chapterContent('c1');
    expect(c.content, 'LOCAL');
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `flutter test test/data/stories_repository_offline_test.dart`
Expected: FAIL (ctor chưa nhận offline/connectivity).

- [ ] **Step 3: Sửa `stories_repository.dart`**

3a. Thêm import + field + ctor:
```dart
import '../offline/offline_store.dart';
import '../offline/offline_models.dart';
import '../offline/connectivity_service.dart';
import '../offline/download_manager.dart';
```
```dart
class StoriesRepository implements StoriesRepositoryLike {
  StoriesRepository(this._api, [this._cache, this._offline, this._connectivity]);
  final ApiClient _api;
  final JsonCache? _cache;
  final OfflineStore? _offline;
  final ConnectivityService? _connectivity;
```

3b. Sửa `chapterContent` (local-first):
```dart
  Future<ChapterContent> chapterContent(String id) async {
    final off = _offline;
    final offline = _connectivity?.isOnline == false;
    final isDownloaded = off?.download(_storyIdOfChapter(id))?.kind == 'downloaded';
    if (off != null && off.hasChapter(id) && (isDownloaded || offline)) {
      final c = off.readChapter(id)!;
      return ChapterContent(id: c.chapterId, n: c.n, title: c.title, content: c.content);
    }
    final data = await _api.get(ApiEndpoints.chapterPublic(id));
    final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final content = ChapterContent(
      id: (m['id'] ?? id).toString(),
      n: _int(m['chapterNumber'], 1),
      title: (m['title'] ?? '').toString(),
      content: (m['content'] ?? '').toString(),
      hlsUrl: m['hlsUrl']?.toString(),
    );
    // Auto-cache text nếu có offline store (không đụng eviction ở đây — làm khi save audio/AppState).
    if (off != null && content.content.isNotEmpty) {
      await off.saveChapter(OfflineChapter(
        chapterId: content.id, storyId: (m['storyId'] ?? '').toString(),
        n: content.n, title: content.title, content: content.content, hasAudio: false));
    }
    return content;
  }

  String _storyIdOfChapter(String chapterId) => _offline?.readChapter(chapterId)?.storyId ?? '';
```

3c. Thêm adapter `StoriesRepositoryLike` cuối class:
```dart
  @override
  Future<String> chapterText(String chapterId) async => (await chapterContent(chapterId)).content;

  @override
  Future<StoryDetailData> detailData(String storyIdOrSlug) async {
    final d = await detail(storyIdOrSlug);
    return StoryDetailData(
      storyId: d.book.id, slug: storyIdOrSlug, title: d.book.title, cover: d.book.cover,
      author: d.book.author, language: 'vi', synopsis: d.book.synopsis, subtitle: d.book.subtitle,
      status: d.book.status, genre: d.book.genre, trope: d.book.trope,
      rating: d.book.rating, reads: d.book.reads, unlockPrice: d.book.unlockPrice,
      discountPercent: d.book.discountPercent,
      chapters: d.chapters.map((c) => ChapterMeta(
        chapterId: c.id, n: c.n, title: c.title,
        state: c.state.name, hasAudio: c.hasAudio)).toList());
  }
```

- [ ] **Step 4: Chạy test → PASS**

Run: `flutter test test/data/stories_repository_offline_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/repositories/stories_repository.dart test/data/stories_repository_offline_test.dart
git commit -m "feat(offline): StoriesRepository local-first + DownloadManager adapter"
```

---

## Task 9: Bootstrap offline services trong main.dart + audio Uri.file

**Files:**
- Modify: `lib/main.dart:23-62,84-94`
- Modify: `lib/state/app_state.dart` (audio source dùng local nếu có) — chỉ nếu cần cho luồng Reader; xem ghi chú.
- Test: (thủ công — smoke boot; không có unit cho wiring)

**Interfaces:**
- Consumes: mọi service Task 2-8.
- Produces: các Provider `OfflineStore`, `ConnectivityService`, `DownloadManager`, `OfflineNotifier(=DownloadManager)` để UI dùng qua `context.read/watch`.

- [ ] **Step 1: Thêm import vào `main.dart`**

```dart
import 'package:hive_flutter/hive_flutter.dart';
import 'package:dio/dio.dart';
import 'data/offline/file_store.dart';
import 'data/offline/offline_store.dart';
import 'data/offline/connectivity_service.dart';
import 'data/offline/download_manager.dart';
```

- [ ] **Step 2: Khởi tạo trong `main()`** (sau `apiClient`, trước `runApp`)

```dart
  // Offline: Hive + FileStore + store + connectivity + download manager.
  await Hive.initFlutter();
  final offlineStore = OfflineStore(
    downloads: await Hive.openBox('downloads'),
    chapters: await Hive.openBox('chapters'),
    storyMeta: await Hive.openBox('storyMeta'),
    files: await FileStore.open(),
  );
  final connectivity = ConnectivityService();
  await connectivity.start();
  final dio = Dio();
  final downloadManager = DownloadManager(
    storiesRepo, audioRepo, offlineStore,
    downloader: (url, storyId, chapterId) async {
      final path = (await FileStore.open()).audioPath(storyId, chapterId);
      await dio.download(url, path);
      return File(path).lengthSync();
    },
  );
```
> Sửa dòng tạo `storiesRepo` thành: `final storiesRepo = StoriesRepository(apiClient, cache, offlineStore, connectivity);` (di chuyển khởi tạo `offlineStore`/`connectivity` lên TRƯỚC dòng này). `audioRepo` giữ nguyên.

- [ ] **Step 2b: Cho `AudioRepository` implement `AudioUrlResolver`** (để truyền vào DownloadManager)

Sửa `lib/data/repositories/audio_repository.dart`: thêm import + `implements`:
```dart
import '../offline/download_manager.dart';
// ...
class AudioRepository implements AudioUrlResolver {
```
Signature `chapterAudioUrl(String chapterId, {String? variantId})` đã khớp interface — chỉ cần thêm `@override`.

- [ ] **Step 3: Truyền vào `NovelVerseApp` + Provider**

Thêm field vào `NovelVerseApp` (`offlineStore`, `connectivity`, `downloadManager`) và trong `MultiProvider`:
```dart
        Provider.value(value: offlineStore),
        ChangeNotifierProvider.value(value: connectivity),
        ChangeNotifierProvider.value(value: downloadManager),
```

- [ ] **Step 4: Audio phát local (Reader/AppState)** — trong `AppState`, hàm phát audiobook nhận thêm khả năng path local. Vì `_listen` ở `book_detail_screen` gọi `AudioRepository.chapterAudioUrl` rồi `AppState.play*`, thêm nhánh: nếu `offlineStore.audioPath(storyId, chapterId) != null` → phát `Uri.file(path)` thay vì resolve mạng. (Chi tiết ở Task 11 khi sửa `_listen`.)

- [ ] **Step 5: Smoke run**

Run: `flutter analyze lib/main.dart` → "No issues found!"
Run (thủ công trên máy): build & mở app, vào Home → không crash, dữ liệu online vẫn chạy.

- [ ] **Step 6: Commit**

```bash
git add lib/main.dart
git commit -m "feat(offline): bootstrap offline services + providers"
```

---

## Task 10: BookDetail — ẩn Listen khi không audio

**Files:**
- Modify: `lib/screens/novel/book_detail_screen.dart:168-173,42-63`
- Test: `test/screens/book_detail_listen_test.dart` (widget test tối thiểu cho hàm dựng CTA)

**Interfaces:**
- Consumes: `book`/`chapters` (đã có trong `_body`), `Chapter.hasAudio`.
- Produces: CTA row hiển thị Listen chỉ khi `chapters.any((c) => c.hasAudio)`.

- [ ] **Step 1: Viết test thất bại** (tách hàm thuần `bookHasAudio` để test dễ)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/models/models.dart';
import 'package:novelverse/screens/novel/book_detail_screen.dart';

void main() {
  test('bookHasAudio true nếu có ít nhất 1 chương hasAudio', () {
    expect(bookHasAudio(const [
      Chapter(n: 1, title: 'a', state: ChapterState.free, hasAudio: false),
      Chapter(n: 2, title: 'b', state: ChapterState.free, hasAudio: true),
    ]), true);
  });
  test('bookHasAudio false nếu không chương nào có audio', () {
    expect(bookHasAudio(const [
      Chapter(n: 1, title: 'a', state: ChapterState.free, hasAudio: false),
    ]), false);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `flutter test test/screens/book_detail_listen_test.dart`
Expected: FAIL (`bookHasAudio` chưa có).

- [ ] **Step 3a: Thêm hàm top-level** trong `book_detail_screen.dart` (ngoài class):
```dart
/// True nếu truyện có audiobook (ít nhất 1 chương có audio).
bool bookHasAudio(List<Chapter> chapters) => chapters.any((c) => c.hasAudio);
```

- [ ] **Step 3b: Sửa CTA row** (dòng 168-173) → Listen có điều kiện, Read full-width khi không audio:
```dart
          // ── CTA Read Now / Listen Now ──
          if (bookHasAudio(chapters))
            Row(children: [
              Expanded(child: _cta(context, 'Read Now', null, AppPalette.terracotta, () => context.push('/reader/${book.id}'))),
              const SizedBox(width: Gap.md),
              Expanded(child: _cta(context, 'Listen Now', Icons.play_arrow_rounded, AppPalette.plum, () => _listen(context, book, chapters))),
            ])
          else
            _cta(context, 'Read Now', null, AppPalette.terracotta, () => context.push('/reader/${book.id}')),
```

- [ ] **Step 4: Chạy test → PASS**

Run: `flutter test test/screens/book_detail_listen_test.dart`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add lib/screens/novel/book_detail_screen.dart test/screens/book_detail_listen_test.dart
git commit -m "feat(book-detail): hide Listen when story has no audio"
```

---

## Task 11: BookDetail — nút Tải xuống + tiến độ

**Files:**
- Modify: `lib/screens/novel/book_detail_screen.dart` (thêm nút tải trong khu vực CTA/Chapters header; đọc `DownloadManager` + `OfflineStore`)
- Test: (thủ công — tương tác mạng/đĩa; logic tải đã test ở Task 6)

**Interfaces:**
- Consumes: `context.watch<DownloadManager>()`, `context.read<OfflineStore>()`.
- Produces: nút "Tải xuống"/"Đã tải" + `LinearProgressIndicator` theo `progress[storyId]`.

- [ ] **Step 1: Thêm widget nút tải** trong `_body` (ngay dưới CTA row):
```dart
          const SizedBox(height: Gap.sm),
          _downloadButton(context, book),
```

- [ ] **Step 2: Viết `_downloadButton`** (method trong `_BookDetailScreenState`):
```dart
  Widget _downloadButton(BuildContext context, Book book) {
    final pal = context.pal;
    final dm = context.watch<DownloadManager>();
    final store = context.read<OfflineStore>();
    final p = dm.progress[book.id];
    final rec = store.download(book.id);
    final done = rec?.kind == 'downloaded' && rec?.status == 'complete';

    if (p != null && p.status == 'downloading') {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Đang tải ${p.done}/${p.total} chương…', style: AppType.meta(size: 12.5, color: pal.muted)),
        const SizedBox(height: 6),
        ClipRRect(borderRadius: rounded(6), child: LinearProgressIndicator(value: p.fraction, color: AppPalette.terracotta, backgroundColor: pal.surf2)),
      ]);
    }
    if (done) {
      return Row(children: [
        Icon(Icons.download_done_rounded, size: 18, color: pal.sage),
        const SizedBox(width: 6),
        Text('Đã tải offline', style: AppType.item(size: 13, color: pal.sage)),
        const Spacer(),
        TextButton(onPressed: () async { await store.deleteStory(book.id); setState(() {}); },
          child: Text('Xoá', style: AppType.btn(size: 13, color: AppPalette.terracotta))),
      ]);
    }
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () => dm.downloadStory(book.id),
        icon: const Icon(Icons.download_rounded, size: 18),
        label: const Text('Tải xuống để đọc offline'),
      ),
    );
  }
```
> Thêm import: `package:provider/provider.dart` (nếu chưa), `../../data/offline/download_manager.dart`, `../../data/offline/offline_store.dart`.

- [ ] **Step 3: Sửa `_listen`** để ưu tiên audio local (đầu hàm, trước khi resolve mạng):
```dart
    final store = context.read<OfflineStore>();
    final localPath = store.audioPath(book.id, ch.id);
    if (localPath != null) {
      await context.read<AppState>().playLocalAudiobook(book, ch, localPath);
      if (context.mounted) context.push('/audiobook');
      return;
    }
```
> Cần thêm `AppState.playLocalAudiobook(Book, Chapter, String filePath)` phát `AudioSource.uri(Uri.file(filePath))`. Nếu API `AppState` phát hiện tại khác, dùng đúng hàm phát sẵn có + truyền `Uri.file`. (Xem `_sourceFor` — đã hỗ trợ path; có thể thêm case `file://`.)

- [ ] **Step 4: analyze + smoke**

Run: `flutter analyze lib/screens/novel/book_detail_screen.dart` → No issues.
Thủ công: mở 1 truyện → bấm Tải → thấy tiến độ → "Đã tải offline" + nút Xoá.

- [ ] **Step 5: Commit**

```bash
git add lib/screens/novel/book_detail_screen.dart lib/state/app_state.dart
git commit -m "feat(book-detail): download button + progress + local audio playback"
```

---

## Task 12: BookDetail — chapter list sliver + lazy + reveal-on-scroll-up

**Files:**
- Modify: `lib/screens/novel/book_detail_screen.dart:107-215` (rewrite `_body` → `CustomScrollView`)
- Test: (thủ công — cuộn; logic reveal đơn giản)

**Interfaces:**
- Produces: `_body` dùng `CustomScrollView` với `ScrollController`; state `_showCollapseBtn` theo hướng cuộn.

- [ ] **Step 1: Thêm state + controller** vào `_BookDetailScreenState`:
```dart
  final ScrollController _scroll = ScrollController();
  bool _showCollapseBtn = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() { _scroll.removeListener(_onScroll); _scroll.dispose(); super.dispose(); }

  void _onScroll() {
    if (!_allChapters) { if (_showCollapseBtn) setState(() => _showCollapseBtn = false); return; }
    final up = _scroll.position.userScrollDirection == ScrollDirection.forward;
    if (up != _showCollapseBtn) setState(() => _showCollapseBtn = up);
  }
```
> Import `package:flutter/rendering.dart` cho `ScrollDirection`.

- [ ] **Step 2: Rewrite `_body`** → `Stack` chứa `CustomScrollView` + nút "Thu gọn" nổi:
```dart
  Widget _body(BuildContext context, Book book, List<Chapter> chapters) {
    final pal = context.pal;
    final app = context.watch<AppState>();
    final count = _allChapters ? chapters.length : (chapters.length < 5 ? chapters.length : 5);
    final locked = chapters.where((c) => c.state == ChapterState.coin || c.state == ChapterState.vip).length;

    return Stack(children: [
      CustomScrollView(
        controller: _scroll,
        slivers: [
          SliverToBoxAdapter(child: Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, 0),
            child: _topSection(context, book, chapters, locked), // gói phần header→CTA→bundle→"Chapters" title
          )),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenH),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => Container(
                  decoration: BoxDecoration(color: pal.card, border: Border(top: i == 0 ? BorderSide.none : BorderSide(color: pal.line))),
                  child: _chapterRow(context, book, chapters[i], app),
                ),
                childCount: count,
              ),
            ),
          ),
          if (!_allChapters && chapters.length > count)
            SliverToBoxAdapter(child: Padding(
              padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
              child: InkWell(
                onTap: () => setState(() => _allChapters = true),
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 16), child: Center(child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text('Xem tất cả ${book.chapters} chương', style: AppType.btn(size: 14, color: AppPalette.terracotta)),
                  const SizedBox(width: 4),
                  const Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: AppPalette.terracotta),
                ]))),
              ),
            ))
          else
            const SliverToBoxAdapter(child: SizedBox(height: Gap.xxl)),
        ],
      ),
      // Nút "Thu gọn" nổi — chỉ hiện khi đã sổ và người dùng cuộn LÊN.
      if (_allChapters)
        AnimatedPositioned(
          duration: const Duration(milliseconds: 200),
          left: 0, right: 0,
          bottom: _showCollapseBtn ? 20 : -60,
          child: Center(child: Material(
            color: AppPalette.terracotta, borderRadius: rounded(24), elevation: 4,
            child: InkWell(
              borderRadius: rounded(24),
              onTap: () {
                setState(() { _allChapters = false; _showCollapseBtn = false; });
                _scroll.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
              },
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.keyboard_arrow_up_rounded, size: 20, color: Colors.white),
                  SizedBox(width: 4),
                  Text('Thu gọn', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
          )),
        ),
    ]);
  }
```
> `_topSection` = tách toàn bộ phần trên (header cover, stats, chips, synopsis, CTA row + `_downloadButton`, bundle, tiêu đề "Chapters") ra 1 method trả `Column` — nội dung bê nguyên từ `_body` cũ (dòng 115-185), thay `ListView` children bằng `Column(children: [...])`. Giữ nguyên spacing.
> `animateTo(0)` đưa về đầu — đủ tốt; nếu muốn về đúng mốc "Chapters" thì đo offset sau (YAGNI cho v1).

- [ ] **Step 3: analyze + smoke**

Run: `flutter analyze lib/screens/novel/book_detail_screen.dart` → No issues.
Thủ công (truyện nhiều chương): "Xem tất cả" → cuộn xuống (nút ẩn) → cuộn lên (nút "Thu gọn" hiện) → bấm → gọn về 5 + về đầu.

- [ ] **Step 4: Commit**

```bash
git add lib/screens/novel/book_detail_screen.dart
git commit -m "feat(book-detail): lazy chapter sliver + reveal-on-scroll-up collapse"
```

---

## Task 13: Màn "Đã tải" + route + entry Profile

**Files:**
- Create: `lib/screens/downloads/downloads_screen.dart`
- Modify: `lib/router.dart:16-17,45` (import + route `/downloads`)
- Modify: `lib/screens/profile_screen.dart` (thêm mục "Đã tải" → push `/downloads`)
- Test: (thủ công)

**Interfaces:**
- Consumes: `context.watch<DownloadManager>()`/`context.read<OfflineStore>()` (dùng `listDownloads`, `totalBytes`, `deleteStory`).

- [ ] **Step 1: Viết `downloads_screen.dart`**
```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/offline/download_manager.dart';
import '../../data/offline/offline_store.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

class DownloadsScreen extends StatefulWidget {
  const DownloadsScreen({super.key});
  @override
  State<DownloadsScreen> createState() => _DownloadsScreenState();
}

class _DownloadsScreenState extends State<DownloadsScreen> {
  String _mb(int b) => '${(b / (1024 * 1024)).toStringAsFixed(1)} MB';

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    context.watch<DownloadManager>(); // rebuild khi tải xong
    final store = context.read<OfflineStore>();
    final items = store.listDownloads()..sort((a, b) => b.lastAccessAt.compareTo(a.lastAccessAt));
    final totalDl = store.totalBytes('downloaded');
    final totalAuto = store.totalBytes('auto');

    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(title: const Text('Đã tải'), backgroundColor: pal.bg),
      body: items.isEmpty
          ? Center(child: Text('Chưa có truyện nào được lưu', style: AppType.body(size: 14, color: pal.muted)))
          : ListView(
              padding: const EdgeInsets.all(Gap.screenH),
              children: [
                Text('Đã tải ${_mb(totalDl)}  ·  Tự lưu ${_mb(totalAuto)}', style: AppType.meta(size: 12.5, color: pal.muted)),
                const SizedBox(height: Gap.md),
                for (final r in items) Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Row(children: [
                    SizedBox(width: 54, child: CoverImage(path: r.cover, title: r.title, radius: 10)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(r.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 15, color: pal.ink)),
                      const SizedBox(height: 3),
                      Text('${r.savedChapters}/${r.totalChapters} chương · ${_mb(r.totalBytes)}${r.kind == 'auto' ? ' · tự lưu' : ''}',
                          style: AppType.meta(size: 12, color: pal.muted)),
                    ])),
                    IconButton(
                      icon: Icon(Icons.delete_outline, color: pal.muted),
                      onPressed: () async { await store.deleteStory(r.storyId); setState(() {}); },
                    ),
                  ]),
                ),
              ],
            ),
    );
  }
}
```

- [ ] **Step 2: Thêm route** trong `router.dart`:
```dart
import 'screens/downloads/downloads_screen.dart';
```
```dart
    GoRoute(path: '/downloads', builder: (_, __) => const DownloadsScreen()),
```

- [ ] **Step 3: Thêm entry ở Profile** — trong `profile_screen.dart`, thêm 1 mục danh sách cài đặt (theo pattern hiện có) trỏ `context.push('/downloads')`, nhãn "Đã tải" icon `Icons.download_done_rounded`. (Chèn cạnh các mục account hiện có; dùng đúng widget item sẵn có của màn.)

- [ ] **Step 4: analyze + smoke**

Run: `flutter analyze` → No issues.
Thủ công: Profile → "Đã tải" → thấy list; Xoá → biến mất.

- [ ] **Step 5: Commit**

```bash
git add lib/screens/downloads/downloads_screen.dart lib/router.dart lib/screens/profile_screen.dart
git commit -m "feat(offline): Downloads screen + route + profile entry"
```

---

## Task 14: Auto-cache eviction hook + Offline banner

**Files:**
- Modify: `lib/data/repositories/stories_repository.dart` (gọi `enforceAutoCacheLimit` sau auto-cache) hoặc trong `AppState` khi lưu audio.
- Create: `lib/widgets/offline_banner.dart`
- Modify: `lib/screens/app_shell.dart` (chèn banner)
- Test: (eviction đã test Task 4; banner thủ công)

**Interfaces:**
- Produces: `const kMaxAutoCacheBytes = 200 * 1024 * 1024;` (đặt trong `offline_store.dart`), gọi `enforceAutoCacheLimit(kMaxAutoCacheBytes)` sau mỗi lần auto upsert record `auto`. `OfflineBanner` hiện khi `!connectivity.isOnline`.

- [ ] **Step 1: Thêm hằng số** vào `offline_store.dart` (top-level):
```dart
const int kMaxAutoCacheBytes = 200 * 1024 * 1024;
```

- [ ] **Step 2: Gọi eviction** — nơi tạo/ cập nhật record `kind:'auto'` (khi auto-cache audio trong AppState hoặc khi lưu chương auto), sau `upsertDownload(...auto...)` thêm:
```dart
await offlineStore.enforceAutoCacheLimit(kMaxAutoCacheBytes);
```
> v1: text-only auto-cache (Task 8) chưa tạo record `downloads`; eviction chỉ ý nghĩa khi audio auto-cache tồn tại. Nếu chưa làm audio auto-cache trong phạm vi này, để hook sẵn ở chỗ AppState lưu audio và ghi chú "auto audio-cache = phase sau". (Giữ đúng YAGNI — đừng ép record auto rỗng.)

- [ ] **Step 3: Viết `offline_banner.dart`**
```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../data/offline/connectivity_service.dart';
import '../theme/app_type.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});
  @override
  Widget build(BuildContext context) {
    final online = context.watch<ConnectivityService>().isOnline;
    if (online) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: const Color(0xFF8A5A44),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
      child: Text('Đang offline — chỉ nội dung đã lưu',
          textAlign: TextAlign.center, style: AppType.meta(size: 12, color: Colors.white)),
    );
  }
}
```

- [ ] **Step 4: Chèn banner** vào `app_shell.dart` — trong `Scaffold`, đặt `OfflineBanner` ngay trên `bottomNavigationBar` Column, hoặc trên cùng body. Dùng cách ít xâm lấn: bọc body `Column(children: [const OfflineBanner(), Expanded(child: IndexedStack(...))])`. Import `../widgets/offline_banner.dart`.

- [ ] **Step 5: analyze + smoke**

Run: `flutter analyze` → No issues.
Thủ công: bật chế độ máy bay → banner hiện; tắt → ẩn.

- [ ] **Step 6: Commit**

```bash
git add lib/data/offline/offline_store.dart lib/widgets/offline_banner.dart lib/screens/app_shell.dart lib/state/app_state.dart
git commit -m "feat(offline): auto-cache eviction hook + offline banner"
```

---

## Task 15: Full test + phân tích + build

**Files:** (không sửa — kiểm thử toàn bộ)

- [ ] **Step 1: Chạy toàn bộ test**

Run: `flutter test`
Expected: tất cả PASS.

- [ ] **Step 2: Analyze**

Run: `flutter analyze`
Expected: "No issues found!"

- [ ] **Step 3: Build & cài máy test** (kiểm thử thủ công offline thật)

Build APK: `D:\SetupC\flutter\bin\flutter.bat build apk --release --dart-define=USE_BACKEND=true --dart-define=API_BASE_URL=https://api.dreamtap.me`
Cài: `flutter install -d BQLN4XOZKRW4QCEM --release`
Kịch bản: tải 1 truyện → bật máy bay → mở app → đọc + nghe được chương đã tải; màn "Đã tải" đúng dung lượng; xoá hoạt động.

- [ ] **Step 4: Commit (nếu có chỉnh vặt)**

```bash
git add -A && git commit -m "test(offline): full suite green + manual offline verified"
```

---

## Ghi chú
- **Git:** novelverse hiện chưa là git repo. Nếu muốn theo dõi phiên bản + commit theo plan: chạy `git init` một lần ở `D:\SetupC\Projects\NovelApp\novelverse` (thêm `.gitignore` Flutter chuẩn) trước Task 1. Nếu không, bỏ mọi bước `git commit`.
- **Auto-cache audio** (ghi file audio khi user nghe online) có thể để phase sau nếu muốn thu hẹp: v1 tối thiểu = auto-cache **text** (Task 8) + **download cả truyện** (text+audio, Task 6/11). Eviction hook (Task 14) chỉ kích hoạt khi có record `auto`.
- **detail() theo id vs slug:** DownloadManager/adapter dùng `detail(storyIdOrSlug)` đúng như `reader_screen`/`book_detail` đang gọi; nếu BE phân biệt, truyền đúng định danh mà BookDetail đang dùng (`book.id`).
- **Ngưỡng 200MB** và reveal-on-scroll-up chỉnh sau khi dùng thử.
