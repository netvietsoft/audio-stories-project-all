# Read-along Offline (persist cues + SWR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chương đã tải đọc offline vẫn tô sáng câu theo audio (read-along): persist timing cues vào `OfflineChapter`, đọc ra ở nhánh local-first, kèm SWR refresh nền khi online.

**Architecture:** Thêm field `cues` (raw map wire-format BE `{s,e,p,cs,ce}`) vào `OfflineChapter` (Hive Map thuần). Lưu ở 3 chỗ ghi (auto-cache trong `chapterContent`, textWorker + autoCacheAudio trong `DownloadManager` — merge giữ cues). Nhánh local-first trả `TimingCue` + fire-and-forget refresh nền cả chương khi online (content + cues cùng 1 response → không lệch offset). KHÔNG đụng `reader_screen.dart` (reader đã nhận `ChapterContent.cues` từ Spec 2).

**Tech Stack:** Flutter (Dart ^3.12.2), Hive (Map thuần, KHÔNG TypeAdapter/build_runner), provider, dio (đã có). KHÔNG gói mới.

**Spec:** `docs/superpowers/specs/2026-07-14-readalong-offline-design.md`

## Global Constraints

- Dart SDK `^3.12.2` (giữ nguyên `pubspec.yaml`). KHÔNG thêm dependency.
- Hive lưu **Map thuần** — `cues` là `List<Map>` raw `{s,e,p,cs,ce}`, KHÔNG class mới, KHÔNG serializer mới.
- KHÔNG migration Hive: record cũ thiếu key `cues` → `fromMap` default `const []`.
- KHÔNG đụng: `lib/screens/novel/reader_screen.dart`, `lib/state/app_state.dart`, eviction/`bytesText` (auto-cache text hiện không cập nhật bytes — giữ nguyên), luồng HLS/entitlement, BE/admin.
- Cues ghi **theo response** ở auto-cache online (response không có `timing` → ghi `[]` — server là nguồn sự thật); cues **merge giữ nguyên** ở 2 chỗ ghi của DownloadManager.
- Flutter KHÔNG trong PATH → mọi lệnh flutter dùng `"/d/SetupC/flutter/bin/flutter.bat"` (bash) / `& "D:\SetupC\flutter\bin\flutter.bat"` (PowerShell).
- Git repo tại `D:\SetupC\Projects\NovelApp\novelverse`; commit mỗi task, kết body bằng `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `OfflineChapter.cues` (model)

**Files:**
- Modify: `lib/data/offline/offline_models.dart:75-110` (class `OfflineChapter`)
- Test: `test/offline/offline_chapter_cues_test.dart` (tạo mới)

**Interfaces:**
- Produces: `OfflineChapter.cues: List<Map>` (named param constructor, default `const []`; roundtrip qua `toMap()['cues']` / `fromMap`; `copyWith` bảo toàn). Task 2 và Task 3 dựa vào đúng tên field `cues` này.

- [ ] **Step 1: Viết test thất bại**

Tạo `test/offline/offline_chapter_cues_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/offline/offline_models.dart';

const _cueMap = {'s': 0, 'e': 1000, 'p': 0, 'cs': 0, 'ce': 5};

void main() {
  test('roundtrip toMap/fromMap giữ cues raw map', () {
    const ch = OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 't', content: 'x',
        hasAudio: true, cues: [_cueMap]);
    final back = OfflineChapter.fromMap(ch.toMap());
    expect(back.cues, hasLength(1));
    expect(back.cues.first['s'], 0);
    expect(back.cues.first['ce'], 5);
  });

  test('map cũ (trước field cues) thiếu key → cues rỗng', () {
    final back = OfflineChapter.fromMap({
      'chapterId': 'c1', 'storyId': 's1', 'n': 1,
      'title': 't', 'content': 'x', 'hasAudio': false,
    });
    expect(back.cues, isEmpty);
  });

  test('copyWith giữ cues', () {
    const ch = OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 't', content: 'x',
        hasAudio: true, cues: [_cueMap]);
    expect(ch.copyWith(audioFile: 'a.mp3').cues, hasLength(1));
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/offline/offline_chapter_cues_test.dart`
Expected: FAIL compile — `No named parameter with the name 'cues'`.

- [ ] **Step 3: Thêm `cues` vào `OfflineChapter`**

Trong `lib/data/offline/offline_models.dart`, sửa class `OfflineChapter` thành:

```dart
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
    this.cues = const [],
  });

  final String chapterId, storyId, title, content;
  final int n;
  final bool hasAudio;
  final String? audioFile;

  /// Timing cues read-along, raw map wire-format BE `{s,e,p,cs,ce}` (rỗng nếu chưa có).
  final List<Map> cues;

  OfflineChapter copyWith({String? audioFile}) => OfflineChapter(
        chapterId: chapterId, storyId: storyId, n: n, title: title,
        content: content, hasAudio: hasAudio, audioFile: audioFile ?? this.audioFile,
        cues: cues,
      );

  Map<String, dynamic> toMap() => {
        'chapterId': chapterId, 'storyId': storyId, 'n': n, 'title': title,
        'content': content, 'hasAudio': hasAudio, 'audioFile': audioFile,
        'cues': cues,
      };

  factory OfflineChapter.fromMap(Map map) => OfflineChapter(
        chapterId: (map['chapterId'] ?? '').toString(),
        storyId: (map['storyId'] ?? '').toString(),
        n: map['n'] is int ? map['n'] : int.tryParse('${map['n']}') ?? 0,
        title: (map['title'] ?? '').toString(),
        content: (map['content'] ?? '').toString(),
        hasAudio: map['hasAudio'] == true,
        audioFile: map['audioFile']?.toString(),
        cues: (map['cues'] as List? ?? const []).cast<Map>(),
      );
}
```

(Chỉ đổi: thêm param `this.cues = const []`, field + doc comment, `cues: cues` trong `copyWith`, key `'cues'` trong `toMap`, dòng `cues:` trong `fromMap`. Không đụng `DownloadRecord`/`OfflineStoryMeta`.)

- [ ] **Step 4: Chạy test → PASS**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/offline/offline_chapter_cues_test.dart`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/data/offline/offline_models.dart test/offline/offline_chapter_cues_test.dart
git commit -m "feat(offline): OfflineChapter mang timing cues (raw map, Hive thuần)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Repository — đọc cues ở nhánh local + SWR refresh nền

**Files:**
- Modify: `lib/data/repositories/stories_repository.dart:1` (thêm import `dart:async`), `:214-249` (method `chapterContent`)
- Test: `test/data/stories_repository_readalong_test.dart` (tạo mới)

**Interfaces:**
- Consumes: `OfflineChapter.cues: List<Map>` (Task 1); `TimingCue.fromMap(Map)`, `ChapterContent.cues` (đã có từ Spec 2); `OfflineStore.hasChapter/readChapter/saveChapter/download`; `ConnectivityService.isOnline`.
- Produces: `chapterContent(id)` nhánh local trả `ChapterContent.cues` đã parse; private `_fetchAndCache(String id) → Future<ChapterContent>` (fetch + auto-cache text & cues) và `_refreshInBackground(String id) → Future<void>` (nuốt lỗi). Task 3 KHÔNG gọi trực tiếp 2 method này (chỉ hưởng qua `chapterText` → `chapterContent`).

- [ ] **Step 1: Viết test thất bại**

Tạo `test/data/stories_repository_readalong_test.dart`:

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

/// ApiClient giả: trả response cố định cho mọi GET, đếm số lần gọi.
/// (Kế thừa ApiClient thật nhưng override get → không chạm mạng.)
class _FakeApi extends ApiClient {
  _FakeApi(this.response);
  final Map<String, dynamic> response;
  int calls = 0;
  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    calls++;
    return response;
  }
}

const _oldCue = {'s': 0, 'e': 1000, 'p': 0, 'cs': 0, 'ce': 5};
const _newCue = {'s': 0, 'e': 2000, 'p': 0, 'cs': 0, 'ce': 5};

Map<String, dynamic> _apiChapter({List<Map>? cues}) => {
      'id': 'c1', 'chapterNumber': 1, 'title': 'C1', 'content': 'HELLO SERVER',
      'storyId': 's1', if (cues != null) 'timing': {'v': 1, 'cues': cues},
    };

/// Đợi điều kiện của refresh nền fire-and-forget (poll tối đa ~1s).
Future<void> _waitFor(bool Function() done) async {
  for (var i = 0; i < 100 && !done(); i++) {
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

void main() {
  late Directory tmp; late OfflineStore store; late ConnectivityService conn;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('ra_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
        downloads: await Hive.openBox('downloads'),
        chapters: await Hive.openBox('chapters'),
        storyMeta: await Hive.openBox('storyMeta'),
        files: FileStore(tmp));
    conn = ConnectivityService();
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('offline + local có cues → trả TimingCue, KHÔNG gọi API', () async {
    conn.setOnline(false);
    await store.saveChapter(const OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 'C1', content: 'LOCAL',
        hasAudio: true, cues: [_oldCue]));
    final api = _FakeApi(_apiChapter(cues: const [_newCue]));
    final repo = StoriesRepository(api, null, store, conn);

    final c = await repo.chapterContent('c1');

    expect(c.content, 'LOCAL');
    expect(c.cues, hasLength(1));
    expect(c.cues.first.endMs, 1000);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(api.calls, 0); // offline → không refresh nền
  });

  test('online + truyện downloaded → trả local ngay, refresh nền cập nhật Hive', () async {
    conn.setOnline(true);
    await store.saveChapter(const OfflineChapter(
        chapterId: 'c1', storyId: 's1', n: 1, title: 'C1', content: 'LOCAL',
        hasAudio: true, cues: [_oldCue]));
    await store.upsertDownload(const DownloadRecord(
        storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A', language: 'vi',
        kind: 'downloaded', status: 'complete', totalChapters: 1, savedChapters: 1,
        bytesText: 5, bytesAudio: 0, createdAt: 1, lastAccessAt: 1));
    final api = _FakeApi(_apiChapter(cues: const [_newCue]));
    final repo = StoriesRepository(api, null, store, conn);

    final c = await repo.chapterContent('c1');
    expect(c.content, 'LOCAL');           // instant-open từ local
    expect(c.cues.first.endMs, 1000);     // cues cũ — bản mới hiệu lực lần mở sau

    await _waitFor(() => store.readChapter('c1')!.content == 'HELLO SERVER');
    final saved = store.readChapter('c1')!;
    expect(saved.content, 'HELLO SERVER');            // refresh cả content...
    expect(saved.cues.first['e'], 2000);              // ...lẫn cues, cùng 1 response
    expect(saved.hasAudio, true);                     // merge giữ hasAudio cũ
    expect(api.calls, 1);
  });

  test('online fetch thường → auto-cache lưu cues; response không timing → ghi []', () async {
    conn.setOnline(true);
    final api = _FakeApi(_apiChapter(cues: const [_newCue]));
    final repo = StoriesRepository(api, null, store, conn);

    final c = await repo.chapterContent('c1'); // không local → nhánh fetch
    expect(c.cues.first.endMs, 2000);
    expect(store.readChapter('c1')!.cues, hasLength(1)); // auto-cache đã lưu cues

    // Server gỡ timing → lần fetch sau ghi đè cues = [] (server là nguồn sự thật).
    // (KHÔNG có record 'downloaded' + đang online → vẫn đi nhánh fetch, không local-first.)
    final api2 = _FakeApi(_apiChapter());
    final repo2 = StoriesRepository(api2, null, store, conn);
    await repo2.chapterContent('c1');
    expect(store.readChapter('c1')!.cues, isEmpty);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/stories_repository_readalong_test.dart`
Expected: FAIL — test 1 & 2 fail ở `expect(c.cues, hasLength(1))` (nhánh local hiện trả cues rỗng); test 3 pass sẵn phần đầu nhưng fail ở `store.readChapter('c1')!.cues` (auto-cache chưa lưu cues).

- [ ] **Step 3: Sửa `chapterContent` — tách `_fetchAndCache`, thêm SWR**

Trong `lib/data/repositories/stories_repository.dart`:

3a. Thêm import đầu file (trên `import '../../api/api_client.dart';`):

```dart
import 'dart:async';
```

3b. Thay TOÀN BỘ method `chapterContent` (dòng 214-249, từ doc comment `/// \`GET /chapters/:id/public\`` đến hết dấu `}` trước `String _storyIdOfChapter`) bằng:

```dart
  /// `GET /chapters/:id/public` — nội dung công khai của chương.
  /// Local-first: nếu đã có sẵn offline VÀ (truyện đã downloaded HOẶC đang offline) → đọc local
  /// (kèm cues read-along đã lưu); nếu lúc đó đang ONLINE → refresh NỀN content+cues từ API
  /// (SWR — bản mới có hiệu lực lần mở chương sau).
  Future<ChapterContent> chapterContent(String id) async {
    final off = _offline;
    final offline = _connectivity?.isOnline == false;
    final isDownloaded = off?.download(_storyIdOfChapter(id))?.kind == 'downloaded';
    if (off != null && off.hasChapter(id) && (isDownloaded || offline)) {
      final c = off.readChapter(id)!;
      if (!offline) unawaited(_refreshInBackground(id));
      return ChapterContent(
          id: c.chapterId, n: c.n, title: c.title, content: c.content,
          cues: c.cues.map(TimingCue.fromMap).toList());
    }
    return _fetchAndCache(id);
  }

  /// SWR: làm mới bản offline (content + cues từ CÙNG 1 response — không lệch offset).
  /// Fire-and-forget: nuốt mọi lỗi, giữ nguyên bản local nếu fail.
  Future<void> _refreshInBackground(String id) async {
    try {
      await _fetchAndCache(id);
    } catch (_) {/* mất mạng đột ngột/API lỗi → giữ bản local */}
  }

  /// Fetch `GET /chapters/:id/public` + auto-cache text & cues vào offline store.
  Future<ChapterContent> _fetchAndCache(String id) async {
    final data = await _api.get(ApiEndpoints.chapterPublic(id));
    final m = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final timingMap = m['timing'];
    final rawCues = (timingMap is Map && timingMap['cues'] is List)
        ? (timingMap['cues'] as List).whereType<Map>().toList()
        : const <Map>[];
    final content = ChapterContent(
      id: (m['id'] ?? id).toString(),
      n: _int(m['chapterNumber'], 1),
      title: (m['title'] ?? '').toString(),
      content: (m['content'] ?? '').toString(),
      hlsUrl: m['hlsUrl']?.toString(),
      cues: rawCues.map(TimingCue.fromMap).toList(),
    );
    // Auto-cache text nếu có offline store (không đụng eviction ở đây — làm khi save audio/AppState).
    // MERGE với bản ghi cũ để không xoá mất audioFile đã auto-cache trước đó.
    // Cues ghi THEO response (không merge): server là nguồn sự thật — admin gỡ timing thì local cũng gỡ.
    final off = _offline;
    if (off != null && content.content.isNotEmpty) {
      final existing = off.readChapter(content.id);
      await off.saveChapter(OfflineChapter(
          chapterId: content.id,
          storyId: existing?.storyId.isNotEmpty == true ? existing!.storyId : (m['storyId'] ?? '').toString(),
          n: content.n, title: content.title, content: content.content,
          hasAudio: existing?.hasAudio ?? false, audioFile: existing?.audioFile,
          cues: rawCues));
    }
    return content;
  }
```

(Logic fetch/auto-cache là code cũ chuyển nguyên trạng vào `_fetchAndCache`; thay đổi thực: parse `rawCues` trước rồi tái dùng cho cả `ChapterContent.cues` lẫn `OfflineChapter.cues`, nhánh local trả cues + gọi `unawaited(_refreshInBackground(id))` khi online.)

- [ ] **Step 4: Chạy test → PASS (cả test cũ)**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/`
Expected: PASS toàn bộ (file mới 3 tests + `stories_repository_offline_test.dart`, `stories_repository_detail_offline_test.dart`, `timing_cue_test.dart`… không vỡ).

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/data/repositories/stories_repository.dart test/data/stories_repository_readalong_test.dart
git commit -m "feat(reader): read-along offline — nhánh local trả cues + SWR refresh nền khi online

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: DownloadManager — ghi đè không làm mất cues

**Files:**
- Modify: `lib/data/offline/download_manager.dart:137-139` (textWorker), `:212-214` (autoCacheAudio)
- Test: `test/offline/download_preserve_cues_test.dart` (tạo mới)

**Interfaces:**
- Consumes: `OfflineChapter.cues` (Task 1). (Nhánh audioWorker dòng 177 dùng `copyWith` — Task 1 đã bảo toàn cues, không sửa gì thêm.)
- Produces: không interface mới — chỉ đảm bảo 2 chỗ dựng `OfflineChapter` mới truyền `cues: existing?.cues ?? const []`.

- [ ] **Step 1: Viết test thất bại**

Tạo `test/offline/download_preserve_cues_test.dart`:

```dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/offline/file_store.dart';
import 'package:novelverse/data/offline/offline_store.dart';
import 'package:novelverse/data/offline/offline_models.dart';
import 'package:novelverse/data/offline/download_manager.dart';

const _cueMap = {'s': 0, 'e': 1000, 'p': 0, 'cs': 0, 'ce': 5};

/// Fake repo 1 chương c1 có audio. `chapterText` MÔ PHỎNG hành vi repo thật:
/// auto-cache OfflineChapter (content + cues) vào store TRƯỚC rồi mới trả text
/// (thứ tự thật: chapterText → chapterContent → _fetchAndCache auto-cache).
class _Stories implements StoriesRepositoryLike {
  _Stories(this.store);
  final OfflineStore store;
  @override
  Future<StoryDetailData> detailData(String id) async => StoryDetailData(
      storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A', language: 'vi',
      synopsis: '', subtitle: '', status: 'ongoing', genre: '', trope: '',
      rating: '5', reads: '1', unlockPrice: 0, discountPercent: 0,
      chapters: const [ChapterMeta(chapterId: 'c1', n: 1, title: 'C1', state: 'free', hasAudio: true)]);
  @override
  Future<String> chapterText(String id) async {
    await store.saveChapter(OfflineChapter(
        chapterId: id, storyId: 's1', n: 1, title: 'C1', content: 'TEXT',
        hasAudio: true, cues: const [_cueMap]));
    return 'TEXT';
  }
}

class _Audio implements AudioUrlResolver {
  @override
  Future<String?> chapterAudioUrl(String id, {String? variantId}) async => 'http://x/$id.mp3';
}

void main() {
  late Directory tmp; late OfflineStore store; late DownloadManager dm;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('dpc_test');
    Hive.init('${tmp.path}/hive');
    store = OfflineStore(
        downloads: await Hive.openBox('downloads'),
        chapters: await Hive.openBox('chapters'),
        storyMeta: await Hive.openBox('storyMeta'),
        files: FileStore(tmp));
    dm = DownloadManager(_Stories(store), _Audio(), store,
        downloader: (url, s, c) async => 500, nowMs: () => 123);
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('downloadStory không làm mất cues (textWorker ghi đè + audio copyWith)', () async {
    await dm.downloadStory('s1');
    final c = store.readChapter('c1')!;
    expect(c.content, 'TEXT');
    expect(c.audioFile, 'c1.mp3');
    expect(c.cues, hasLength(1));
    expect(c.cues.first['e'], 1000);
  });

  test('autoCacheAudio giữ content + cues sẵn có', () async {
    await store.saveChapter(const OfflineChapter(
        chapterId: 'c2', storyId: 's1', n: 2, title: 'C2', content: 'TXT',
        hasAudio: true, cues: [_cueMap]));
    await dm.autoCacheAudio(
        storyId: 's1', slug: 's1', title: 'S', cover: '', author: 'A',
        language: 'vi', chapterId: 'c2', n: 2, chapterTitle: 'C2',
        audioUrl: 'http://x/c2.mp3', nowMs: 5);
    final c = store.readChapter('c2')!;
    expect(c.audioFile, 'c2.mp3');
    expect(c.content, 'TXT');
    expect(c.cues, hasLength(1));
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/offline/download_preserve_cues_test.dart`
Expected: FAIL ở `expect(c.cues, hasLength(1))` cả 2 test (textWorker/autoCacheAudio dựng `OfflineChapter` mới không truyền cues → default `[]`).

- [ ] **Step 3: Truyền `cues: existing?.cues` ở 2 chỗ ghi**

Trong `lib/data/offline/download_manager.dart`:

3a. textWorker (dòng 137-139) — thay:

```dart
            await _store.saveChapter(OfflineChapter(
                chapterId: ch.chapterId, storyId: detail.storyId, n: ch.n, title: ch.title,
                content: text, hasAudio: ch.hasAudio, audioFile: existing?.audioFile));
```

bằng:

```dart
            await _store.saveChapter(OfflineChapter(
                chapterId: ch.chapterId, storyId: detail.storyId, n: ch.n, title: ch.title,
                content: text, hasAudio: ch.hasAudio, audioFile: existing?.audioFile,
                cues: existing?.cues ?? const []));
```

3b. autoCacheAudio (dòng 212-214) — thay:

```dart
      await _store.saveChapter(OfflineChapter(
        chapterId: chapterId, storyId: storyId, n: n, title: chapterTitle,
        content: existing?.content ?? '', hasAudio: true, audioFile: '$chapterId.mp3'));
```

bằng:

```dart
      await _store.saveChapter(OfflineChapter(
        chapterId: chapterId, storyId: storyId, n: n, title: chapterTitle,
        content: existing?.content ?? '', hasAudio: true, audioFile: '$chapterId.mp3',
        cues: existing?.cues ?? const []));
```

(KHÔNG sửa audioWorker dòng 175-178 — `copyWith` đã bảo toàn cues từ Task 1.)

- [ ] **Step 4: Chạy test → PASS (cả test offline cũ)**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/offline/`
Expected: PASS toàn bộ (file mới 2 tests + download_manager/auto_cache/resume/cancel/eviction… không vỡ).

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/data/offline/download_manager.dart test/offline/download_preserve_cues_test.dart
git commit -m "fix(offline): DownloadManager ghi đè chương không làm mất cues read-along

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Verify toàn bộ + cập nhật docs

**Files:**
- Modify: `CHANGELOG.md` (entry mới 2026-07-14), `docs/08-read-along.md` (§4.1, §5, §6, ngày cập nhật), `lib/data/README.md:36-39` (mục Read-along)

**Interfaces:** không — task tài liệu + verify.

- [ ] **Step 1: Chạy toàn bộ test + analyze**

```bash
"/d/SetupC/flutter/bin/flutter.bat" test
"/d/SetupC/flutter/bin/flutter.bat" analyze
```

Expected: test PASS toàn bộ (30 test cũ + 8 test mới); analyze 0 lỗi/0 cảnh báo (info `unnecessary_underscores` có sẵn được phép).

- [ ] **Step 2: Cập nhật `CHANGELOG.md`** — chèn entry mới TRÊN entry `## 2026-07-08`:

```markdown
## 2026-07-14

### Read-along offline (SWR)
- **Offline** — timing cues được lưu vào `OfflineChapter` (Hive) ở mọi chỗ ghi (auto-cache khi đọc online, tải cả truyện, auto-cache audio); đọc chương đã tải khi offline vẫn tô sáng câu theo audio đã tải.
- **SWR** — mở chương đã tải lúc online: hiện bản local tức thì + refresh nền cả content lẫn cues từ cùng 1 response (không lệch offset); bản mới hiệu lực lần mở chương sau; admin gỡ timing thì bản local cũng gỡ theo.

---
```

- [ ] **Step 3: Cập nhật `docs/08-read-along.md`** (4 chỗ):

3a. Header: đổi `Cập nhật: 2026-07-08.` → `Cập nhật: 2026-07-14 (v1.1: offline + SWR).`

3b. §4.1 — thay câu cuối (từ `Trong \`chapterContent(id)\`: \`cues\` chỉ được parse...` đến `...(xem §6).`) bằng:

```markdown
Trong `chapterContent(id)`: nhánh **online** parse `cues` từ `m['timing']['cues']` và auto-cache
vào `OfflineChapter.cues` (raw map); nhánh **local-first/offline** đọc `OfflineChapter.cues` đã lưu
→ read-along HOẠT ĐỘNG khi đọc offline (từ 2026-07-14). Khi mở chương đã tải lúc ONLINE: trả bản
local tức thì + refresh NỀN content+cues (SWR, cùng 1 response — không lệch offset), hiệu lực lần
mở sau. Xem spec `docs/superpowers/specs/2026-07-14-readalong-offline-design.md`.
```

3c. §5 — thay dòng bảng `| Đọc offline (đã tải chương) | \`cues\` luôn rỗng ở nhánh local-first hiện tại → read-along không hoạt động khi offline |` bằng:

```markdown
| Đọc offline (đã tải chương) | `cues` đọc từ `OfflineChapter.cues` đã persist → read-along hoạt động; chương tải trước 2026-07-14 (record cũ không có cues) → rỗng cho tới lần mở online kế (SWR refresh) |
```

3d. §6 — thay dòng `- Read-along OFFLINE — chưa persist \`cues\` vào \`OfflineChapter\`; theo sau khi có nhu cầu.` bằng:

```markdown
- ~~Read-along OFFLINE~~ — ĐÃ LÀM 2026-07-14 (persist `cues` vào `OfflineChapter` + SWR refresh nền).
```

- [ ] **Step 4: Cập nhật `lib/data/README.md`** — thay 3 dòng cuối của bullet `ChapterContent.cues` (từ `- \`ChapterContent.cues\`...` đến `...là việc làm sau).`) bằng:

```markdown
- `ChapterContent.cues` (`List<TimingCue>`, mặc định `const []`): nhánh **online** parse từ field
  `timing` của API chương và auto-cache vào `OfflineChapter.cues`; nhánh **offline/local-first**
  đọc từ `OfflineChapter.cues` đã lưu (read-along chạy cả offline). Mở chương đã tải lúc online →
  SWR: trả local ngay + `_refreshInBackground` cập nhật content+cues cho lần mở sau.
```

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add CHANGELOG.md docs/08-read-along.md lib/data/README.md
git commit -m "docs: read-along offline + SWR (CHANGELOG, 08-read-along, lib/data README)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
