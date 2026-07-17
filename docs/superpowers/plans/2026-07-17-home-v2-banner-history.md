# Home v2 — Banner + Đọc tiếp (history/sync) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novel Home có banner carousel từ `GET /banners`; lịch sử đọc local-first (Hive, 50 truyện) ghi khi mở chương; nút "More..." cạnh Continue Reading mở màn `/reading-history` (card: thumb trái to · tiêu đề · tóm tắt 20 từ · progress bar · "Chương x/y" · thể loại + views); sync ngầm 2 chiều với BE khi đã đăng nhập.

**Architecture:** 2 repo mới (`BannersRepository`, `HistoryRepository`) + store local `ReadingHistoryStore` (Hive box map thuần) + helpers thuần test được (`truncateWords`, `mergeHistory`). Reader ghi store + push sync fire-and-forget; Home pull-merge 1 lần khi login, render banner qua widget file riêng. Màn history đọc local, mở tức thì.

**Tech Stack:** Flutter, Hive, provider, dio (đã có); dep MỚI duy nhất: `url_launcher`.

**Spec:** `docs/superpowers/specs/2026-07-17-home-v2-banner-history-design.md`

> **⚠ ERRATUM 2026-07-17 (sau review Task 1 — contract banner trong plan SAI so với BE thật, đã verify `backend/be/src/banners/banners.service.ts` + curl prod).** `GET /banners` serve bảng **HeroBanner**, không phải model `Banner{linkUrl, position}` (model chết trong schema, không endpoint nào dùng). Contract đúng, MỌI chỗ trong plan nhắc `AppBanner`/`linkUrl`/`position` phải đọc theo đây:
> - Query BE chấp nhận: `lang` ('vi'|'en') và `active` — **KHÔNG có `position`** (whitelist drop). Repo: `BannersRepository.list({String lang = 'vi'})` → `GET /banners?lang=`.
> - Row thật: `{id: String UUID, title (BE đã localize theo lang), subtitle, imageUrl, targetUrl, storyId, order, isActive, story: {id, slug, title} | null}` — key là **`targetUrl`** (không phải `linkUrl`).
> - Model app: `AppBanner {id: String, title, imageUrl, targetUrl: String?, storySlug: String?}` (`storySlug` = `story.slug`; rỗng → null).
> - **Task 5 `_open` đổi theo**: `storySlug != null` → `context.push('/book/<storySlug>')` (KHÔNG parse `/story/` từ URL nữa); ngược lại `targetUrl` != null → `launchUrl` external; cả hai null → không bấm được.
> - Fix đã vào commit Task 1 (sau `d002465`); test fixture theo shape thật.

## Global Constraints

- Dep mới DUY NHẤT: `url_launcher: ^6.3.1`. KHÔNG sửa BE.
- Endpoint: `GET /banners?lang=` (xem ERRATUM đầu file — KHÔNG có position; const `banners` ĐÃ có trong api_endpoints.dart) · `POST /history/sync {storyId: UUID, chapterId: UUID, progressSeconds: int ≥ 0}` (Bearer) · `GET /history?limit=50` (Bearer; row có `lastListenedAt`, `story {id, slug, title, thumbnailUrl, totalViews, status, author}`, `chapter {id, chapterNumber, title}`).
- History local: Hive box `readingHistory`, entry Map thuần `{bookId, storyUuid, title, cover, synopsis, genre, reads, totalChapters, chapter, savedAt}`; giới hạn 50 entry (xoá cũ nhất); sort savedAt desc.
- Card màn history NGUYÊN VĂN spec §4: thumb trái to (~96px) · tiêu đề 1 dòng · tóm tắt 20 TỪ (cắt theo từ + '…') · progress bar terracotta · "Chương x / y" · dòng cuối thể loại (trái) + reads (phải).
- Khách = local-only; sync CHỈ khi `AuthNotifier.user != null`. Push cần cả `storyUuid` + `chapterId` không rỗng. Mọi lỗi sync/banner nuốt (không chặn UI).
- KHÔNG đụng: card Continue Reading 1 truyện hiện tại (AppState.lastRead*), Editor's Pick/kệ/trending/ranking, reader ngoài `_recordLastRead`, BE.
- Flutter KHÔNG trong PATH → `"/d/SetupC/flutter/bin/flutter.bat"` (bash).
- Git repo `D:\SetupC\Projects\NovelApp\novelverse` (master, remote origin `novelverse-master`); commit mỗi task (body kết `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`) và `git push` sau commit.

---

### Task 1: BannersRepository + HistoryRepository + provider

**Files:**
- Create: `lib/data/repositories/banners_repository.dart`, `lib/data/repositories/history_repository.dart`
- Modify: `lib/main.dart` (tạo 2 instance + truyền App + 2 `Provider.value` — mirror pattern `categoriesRepo` ở 3 chỗ: ~dòng 65, field class App ~120, MultiProvider ~136)
- Test: `test/data/banners_history_repo_test.dart` (tạo mới)

**Interfaces:**
- Produces: `AppBanner {id: int, title, imageUrl, linkUrl: String?}`; `BannersRepository.list({String position = 'home_hero'}) → Future<List<AppBanner>>`; `RemoteHistoryEntry {storyUuid, slug, title, cover, reads, chapterNumber: int, lastListenedAtMs: int}`; `HistoryRepository.sync({required String storyUuid, required String chapterId, int progressSeconds = 0}) → Future<void>`, `HistoryRepository.list({int limit = 50}) → Future<List<RemoteHistoryEntry>>`. Task 4/5 dùng đúng tên này.

- [ ] **Step 1: Viết test thất bại** — tạo `test/data/banners_history_repo_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/repositories/banners_repository.dart';
import 'package:novelverse/data/repositories/history_repository.dart';

class _FakeApi extends ApiClient {
  _FakeApi(this.response);
  final dynamic response;
  String? lastPath;
  Map<String, dynamic>? lastQuery;
  Object? lastBody;
  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    lastPath = path; lastQuery = query;
    return response;
  }
  @override
  Future<dynamic> post(String path, {Object? body}) async {
    lastPath = path; lastBody = body;
    return const {};
  }
}

void main() {
  test('banners: đúng path/query + parse (linkUrl null OK)', () async {
    final api = _FakeApi([
      {'id': 1, 'title': 'Sự kiện', 'imageUrl': 'https://x/b.jpg', 'linkUrl': 'https://dreamtap.me/story/tien-nghich'},
      {'id': 2, 'title': 'Trống link', 'imageUrl': 'https://x/c.jpg', 'linkUrl': null},
    ]);
    final repo = BannersRepository(api);
    final list = await repo.list();
    expect(api.lastPath, '/banners');
    expect(api.lastQuery?['position'], 'home_hero');
    expect(list, hasLength(2));
    expect(list.first.linkUrl, contains('/story/'));
    expect(list.last.linkUrl, isNull);
  });

  test('history sync: đúng path + body', () async {
    final api = _FakeApi(const {});
    final repo = HistoryRepository(api);
    await repo.sync(storyUuid: 'uuid-1', chapterId: 'ch-1');
    expect(api.lastPath, '/history/sync');
    expect(api.lastBody, {'storyId': 'uuid-1', 'chapterId': 'ch-1', 'progressSeconds': 0});
  });

  test('history list: parse story + chapterNumber + lastListenedAt', () async {
    final api = _FakeApi({
      'data': [
        {
          'lastListenedAt': '2026-07-17T04:00:00.000Z',
          'story': {'id': 'uuid-1', 'slug': 'tien-nghich', 'title': 'Tiên Nghịch', 'thumbnailUrl': 'https://x/t.jpg', 'totalViews': 1234},
          'chapter': {'id': 'ch-9', 'chapterNumber': 9, 'title': 'Chương 9'},
        }
      ],
      'meta': {'total': 1},
    });
    final repo = HistoryRepository(api);
    final rows = await repo.list();
    expect(api.lastPath, '/history');
    expect(api.lastQuery?['limit'], 50);
    final r = rows.single;
    expect(r.slug, 'tien-nghich');
    expect(r.storyUuid, 'uuid-1');
    expect(r.chapterNumber, 9);
    expect(r.lastListenedAtMs, DateTime.parse('2026-07-17T04:00:00.000Z').millisecondsSinceEpoch);
  });
}
```

- [ ] **Step 2: Chạy test → FAIL** — `"/d/SetupC/flutter/bin/flutter.bat" test test/data/banners_history_repo_test.dart` → compile fail (file chưa tồn tại).

- [ ] **Step 3a: Tạo `lib/data/repositories/banners_repository.dart`:**

```dart
import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';

/// 1 banner quảng bá (admin quản, BE lọc isActive/start-end, sort orderIndex).
class AppBanner {
  const AppBanner({required this.id, required this.title, required this.imageUrl, required this.linkUrl});
  final int id;
  final String title, imageUrl;
  final String? linkUrl;

  factory AppBanner.fromJson(Map<String, dynamic> j) => AppBanner(
        id: j['id'] is num ? (j['id'] as num).toInt() : 0,
        title: (j['title'] ?? '').toString(),
        imageUrl: (j['imageUrl'] ?? '').toString(),
        linkUrl: (j['linkUrl'] as String?)?.isNotEmpty == true ? j['linkUrl'] as String : null,
      );
}

/// Banner Home (`GET /banners?position=home_hero`).
class BannersRepository {
  BannersRepository(this._api);
  final ApiClient _api;

  Future<List<AppBanner>> list({String position = 'home_hero'}) async {
    final data = await _api.get(ApiEndpoints.banners, query: {'position': position});
    return unwrapList(data)
        .whereType<Map>()
        .map((j) => AppBanner.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }
}
```

- [ ] **Step 3b: Tạo `lib/data/repositories/history_repository.dart`:**

```dart
import '../../api/api_client.dart';

/// 1 dòng lịch sử đọc/nghe từ BE (`GET /history` — kèm story + chapter).
class RemoteHistoryEntry {
  const RemoteHistoryEntry({
    required this.storyUuid,
    required this.slug,
    required this.title,
    required this.cover,
    required this.reads,
    required this.chapterNumber,
    required this.lastListenedAtMs,
  });
  final String storyUuid, slug, title, cover, reads;
  final int chapterNumber, lastListenedAtMs;

  factory RemoteHistoryEntry.fromJson(Map<String, dynamic> j) {
    final s = j['story'];
    final c = j['chapter'];
    final t = DateTime.tryParse((j['lastListenedAt'] ?? '').toString());
    num? views = s is Map && s['totalViews'] is num ? s['totalViews'] as num : null;
    return RemoteHistoryEntry(
      storyUuid: ((s is Map ? s['id'] : null) ?? '').toString(),
      slug: ((s is Map ? s['slug'] : null) ?? '').toString(),
      title: ((s is Map ? s['title'] : null) ?? '').toString(),
      cover: ((s is Map ? s['thumbnailUrl'] : null) ?? '').toString(),
      reads: views == null ? '' : '${views.toInt()}',
      chapterNumber: (c is Map && c['chapterNumber'] is num) ? (c['chapterNumber'] as num).toInt() : 1,
      lastListenedAtMs: t?.millisecondsSinceEpoch ?? 0,
    );
  }
}

/// Sync lịch sử đọc với BE (CHỈ khi đã đăng nhập — Bearer tự gắn).
class HistoryRepository {
  HistoryRepository(this._api);
  final ApiClient _api;

  /// Đẩy tiến độ 1 chương lên BE (fire-and-forget từ reader).
  Future<void> sync({required String storyUuid, required String chapterId, int progressSeconds = 0}) =>
      _api.post('/history/sync', body: {
        'storyId': storyUuid,
        'chapterId': chapterId,
        'progressSeconds': progressSeconds,
      });

  /// Kéo lịch sử từ BE (sort mới nhất trước).
  Future<List<RemoteHistoryEntry>> list({int limit = 50}) async {
    final body = await _api.get('/history', raw: true, query: {'limit': limit});
    return unwrapList(body)
        .whereType<Map>()
        .map((j) => RemoteHistoryEntry.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }
}
```

LƯU Ý: thêm 2 const vào `lib/api/api_endpoints.dart` nhóm "Khác" nếu muốn đồng bộ convention (`historySync = '/history/sync'`, `history = '/history'`) và dùng thay string trần — BẮT BUỘC làm để giữ quy tắc "path tập trung một nơi" của file đó.

- [ ] **Step 3c: `lib/main.dart`** — mirror `categoriesRepo` ở 3 chỗ: thêm `final bannersRepo = BannersRepository(apiClient);` + `final historyRepo = HistoryRepository(apiClient);` (sau categoriesRepo), 2 import, truyền qua constructor App (field + param), 2 dòng `Provider.value(value: ...)` trong MultiProvider.

- [ ] **Step 4: Test PASS** — `"/d/SetupC/flutter/bin/flutter.bat" test test/data/` → toàn bộ pass.

- [ ] **Step 5: Commit + push**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/api/api_endpoints.dart lib/data/repositories/banners_repository.dart lib/data/repositories/history_repository.dart lib/main.dart test/data/banners_history_repo_test.dart
git commit -m "feat(data): BannersRepository + HistoryRepository (sync/list) cho Home v2

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 2: ReadingHistoryStore + helpers thuần (truncateWords, mergeHistory)

**Files:**
- Create: `lib/data/reading_history/reading_history_store.dart`
- Modify: `lib/main.dart` (mở box + tạo store + Provider.value — cạnh offlineStore boxes ~dòng 56-59)
- Test: `test/data/reading_history_store_test.dart` (tạo mới)

**Interfaces:**
- Consumes (Task 1): `RemoteHistoryEntry`.
- Produces: `ReadingHistoryEntry {bookId, storyUuid: String?, title, cover, synopsis, genre, reads, totalChapters: int, chapter: int, savedAt: int}` (+ `toMap`/`fromMap`); `ReadingHistoryStore(Box box)` với `.record(ReadingHistoryEntry)` (upsert theo bookId + cắt 50 cũ nhất), `.entries() → List<ReadingHistoryEntry>` (savedAt desc), `.get(bookId)`; hàm thuần `String truncateWords(String s, int maxWords)` và `List<ReadingHistoryEntry> mergeHistory(List<ReadingHistoryEntry> local, List<RemoteHistoryEntry> remote)` (BE mới hơn thắng: cập nhật chapter/savedAt từ remote; truyện chỉ có remote → entry mới với synopsis/genre rỗng; local mới hơn giữ nguyên; kết quả sort savedAt desc). Task 3/4/5 dùng đúng tên này.

- [ ] **Step 1: Viết test thất bại** — tạo `test/data/reading_history_store_test.dart`:

```dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:novelverse/data/reading_history/reading_history_store.dart';
import 'package:novelverse/data/repositories/history_repository.dart';

ReadingHistoryEntry _e(String id, int chapter, int savedAt) => ReadingHistoryEntry(
    bookId: id, storyUuid: 'u-$id', title: 'T$id', cover: '', synopsis: 'tóm tắt dài',
    genre: 'Tiên hiệp', reads: '1K', totalChapters: 100, chapter: chapter, savedAt: savedAt);

void main() {
  late Directory tmp; late ReadingHistoryStore store;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('rh_test');
    Hive.init('${tmp.path}/hive');
    store = ReadingHistoryStore(await Hive.openBox('readingHistory'));
  });
  tearDown(() async { await Hive.close(); await tmp.delete(recursive: true); });

  test('record upsert theo bookId + entries sort savedAt desc', () async {
    await store.record(_e('a', 1, 100));
    await store.record(_e('b', 2, 200));
    await store.record(_e('a', 5, 300)); // update a
    final list = store.entries();
    expect(list.map((x) => x.bookId), ['a', 'b']);
    expect(list.first.chapter, 5);
  });

  test('giới hạn 50 — xoá cũ nhất', () async {
    for (var i = 0; i < 55; i++) {
      await store.record(_e('b$i', 1, i));
    }
    final list = store.entries();
    expect(list, hasLength(50));
    expect(list.any((x) => x.bookId == 'b0'), isFalse); // cũ nhất bị xoá
    expect(list.first.bookId, 'b54');
  });

  test('truncateWords: 20 từ + … ; ngắn giữ nguyên; whitespace thừa không tạo từ rỗng', () {
    final long = List.generate(30, (i) => 'từ$i').join(' ');
    final out = truncateWords(long, 20);
    expect(out.endsWith('…'), isTrue);
    expect(out.split(' '), hasLength(20)); // 20 từ (từ cuối dính '…')
    expect(truncateWords('ngắn thôi', 20), 'ngắn thôi');
    expect(truncateWords('a   b\n\nc', 2), 'a b…');
  });

  test('mergeHistory: remote mới hơn thắng, local mới hơn giữ, remote-only thêm mới', () {
    final local = [_e('a', 3, 1000), _e('b', 7, 5000)];
    final remote = [
      RemoteHistoryEntry(storyUuid: 'u-a', slug: 'a', title: 'Ta', cover: 'c', reads: '9', chapterNumber: 4, lastListenedAtMs: 2000), // mới hơn local a
      RemoteHistoryEntry(storyUuid: 'u-b', slug: 'b', title: 'Tb', cover: 'c', reads: '9', chapterNumber: 1, lastListenedAtMs: 100),  // cũ hơn local b
      RemoteHistoryEntry(storyUuid: 'u-c', slug: 'c', title: 'Tc', cover: 'c', reads: '9', chapterNumber: 2, lastListenedAtMs: 3000), // chỉ có remote
    ];
    final merged = mergeHistory(local, remote);
    expect(merged.map((x) => x.bookId), ['b', 'c', 'a']); // sort savedAt desc: b(5000), c(3000), a(2000)
    expect(merged.firstWhere((x) => x.bookId == 'a').chapter, 4);
    expect(merged.firstWhere((x) => x.bookId == 'b').chapter, 7);
    expect(merged.firstWhere((x) => x.bookId == 'c').synopsis, '');
  });
}
```

- [ ] **Step 2: FAIL** — `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reading_history_store_test.dart` → compile fail.

- [ ] **Step 3: Tạo `lib/data/reading_history/reading_history_store.dart`:**

```dart
import 'package:hive/hive.dart';

import '../repositories/history_repository.dart';

/// 1 truyện đang đọc dở (entry lịch sử local — nguồn màn "Đang đọc" + sync).
class ReadingHistoryEntry {
  const ReadingHistoryEntry({
    required this.bookId,
    required this.storyUuid,
    required this.title,
    required this.cover,
    required this.synopsis,
    required this.genre,
    required this.reads,
    required this.totalChapters,
    required this.chapter,
    required this.savedAt,
  });

  final String bookId, title, cover, synopsis, genre, reads;
  final String? storyUuid;
  final int totalChapters, chapter, savedAt;

  Map<String, dynamic> toMap() => {
        'bookId': bookId, 'storyUuid': storyUuid, 'title': title, 'cover': cover,
        'synopsis': synopsis, 'genre': genre, 'reads': reads,
        'totalChapters': totalChapters, 'chapter': chapter, 'savedAt': savedAt,
      };

  factory ReadingHistoryEntry.fromMap(Map m) {
    int i(dynamic v, int d) => v is num ? v.toInt() : d;
    return ReadingHistoryEntry(
      bookId: (m['bookId'] ?? '').toString(),
      storyUuid: m['storyUuid']?.toString(),
      title: (m['title'] ?? '').toString(),
      cover: (m['cover'] ?? '').toString(),
      synopsis: (m['synopsis'] ?? '').toString(),
      genre: (m['genre'] ?? '').toString(),
      reads: (m['reads'] ?? '').toString(),
      totalChapters: i(m['totalChapters'], 0),
      chapter: i(m['chapter'], 1),
      savedAt: i(m['savedAt'], 0),
    );
  }
}

/// Lịch sử đọc local-first (Hive box `readingHistory`, key = bookId, tối đa 50).
class ReadingHistoryStore {
  ReadingHistoryStore(this._box);
  final Box _box;

  static const int maxEntries = 50;

  /// Upsert entry theo bookId; vượt [maxEntries] → xoá entry savedAt CŨ NHẤT.
  Future<void> record(ReadingHistoryEntry e) async {
    await _box.put(e.bookId, e.toMap());
    if (_box.length > maxEntries) {
      final all = entries();
      for (final old in all.skip(maxEntries)) {
        await _box.delete(old.bookId);
      }
    }
  }

  /// Toàn bộ entry, mới đọc nhất trước.
  List<ReadingHistoryEntry> entries() {
    final list = _box.values
        .whereType<Map>()
        .map(ReadingHistoryEntry.fromMap)
        .toList()
      ..sort((a, b) => b.savedAt.compareTo(a.savedAt));
    return list;
  }

  ReadingHistoryEntry? get(String bookId) {
    final m = _box.get(bookId);
    return m is Map ? ReadingHistoryEntry.fromMap(m) : null;
  }
}

/// Cắt chuỗi theo TỪ: quá [maxWords] → lấy maxWords từ đầu + '…' (dính từ cuối).
String truncateWords(String s, int maxWords) {
  final words = s.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.length <= maxWords) return words.join(' ');
  return '${words.take(maxWords).join(' ')}…';
}

/// Merge lịch sử BE vào local: remote MỚI HƠN thắng (cập nhật chapter/savedAt,
/// giữ synopsis/genre local); truyện chỉ có remote → entry mới (synopsis/genre
/// rỗng — card render bỏ dòng); local mới hơn giữ nguyên. Kết quả savedAt desc.
List<ReadingHistoryEntry> mergeHistory(List<ReadingHistoryEntry> local, List<RemoteHistoryEntry> remote) {
  final byId = {for (final e in local) e.bookId: e};
  for (final r in remote) {
    if (r.slug.isEmpty) continue;
    final cur = byId[r.slug];
    if (cur == null) {
      byId[r.slug] = ReadingHistoryEntry(
        bookId: r.slug, storyUuid: r.storyUuid, title: r.title, cover: r.cover,
        synopsis: '', genre: '', reads: r.reads,
        totalChapters: 0, chapter: r.chapterNumber, savedAt: r.lastListenedAtMs,
      );
    } else if (r.lastListenedAtMs > cur.savedAt) {
      byId[r.slug] = ReadingHistoryEntry(
        bookId: cur.bookId, storyUuid: cur.storyUuid ?? r.storyUuid, title: cur.title,
        cover: cur.cover, synopsis: cur.synopsis, genre: cur.genre,
        reads: cur.reads.isEmpty ? r.reads : cur.reads,
        totalChapters: cur.totalChapters, chapter: r.chapterNumber, savedAt: r.lastListenedAtMs,
      );
    }
  }
  final out = byId.values.toList()..sort((a, b) => b.savedAt.compareTo(a.savedAt));
  return out;
}
```

- [ ] **Step 4: `lib/main.dart`** — sau khối OfflineStore (dòng ~60): `final readingHistory = ReadingHistoryStore(await Hive.openBox('readingHistory'));` + import + truyền App + `Provider.value(value: readingHistory)`.

- [ ] **Step 5: Test PASS** — `"/d/SetupC/flutter/bin/flutter.bat" test test/data/reading_history_store_test.dart` rồi full `test test/data/`.

- [ ] **Step 6: Commit + push**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/data/reading_history/reading_history_store.dart lib/main.dart test/data/reading_history_store_test.dart
git commit -m "feat(data): ReadingHistoryStore local-first + truncateWords/mergeHistory

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Màn `/reading-history` — danh sách đang đọc dở

**Files:**
- Create: `lib/screens/novel/reading_history_screen.dart`
- Modify: `lib/router.dart` (import + route sau `/category/:id`)

**Interfaces:**
- Consumes (Task 2): `ReadingHistoryStore.entries()`, `ReadingHistoryEntry`, `truncateWords`.
- Produces: route `/reading-history` — Task 5 push tới từ nút More.

- [ ] **Step 1: Tạo `lib/screens/novel/reading_history_screen.dart`:**

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/reading_history/reading_history_store.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Danh sách truyện ĐANG ĐỌC DỞ (đích nút "More..." cạnh Continue Reading).
/// Đọc từ ReadingHistoryStore local — mở tức thì, không network.
/// Card layout (chốt với user): thumb trái to · tiêu đề · tóm tắt 20 từ ·
/// progress bar · "Chương x / y" · thể loại (trái) + views (phải).
class ReadingHistoryScreen extends StatelessWidget {
  const ReadingHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final entries = context.read<ReadingHistoryStore>().entries();
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        iconTheme: IconThemeData(color: pal.ink),
        title: Text('Đang đọc', style: AppType.section(color: pal.ink)),
      ),
      body: entries.isEmpty
          ? Center(child: Text('Chưa có truyện đang đọc', style: AppType.body(size: 14, color: pal.muted)))
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.md, Gap.screenH, Gap.xxl),
              itemCount: entries.length,
              separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
              itemBuilder: (_, i) => _card(context, entries[i]),
            ),
    );
  }

  Widget _card(BuildContext context, ReadingHistoryEntry e) {
    final pal = context.pal;
    final progress = e.totalChapters > 0 ? (e.chapter / e.totalChapters).clamp(0.0, 1.0) : 0.0;
    return GestureDetector(
      onTap: () => context.push('/reader/${e.bookId}?ch=${e.chapter}'),
      child: Container(
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: pal.card,
          borderRadius: rounded(Radii.card),
          border: Border.all(color: pal.line),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumb truyện TO NHẤT phía tay trái.
            SizedBox(width: 96, child: CoverImage(path: e.cover, title: e.title)),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: AppType.item(size: 15, color: pal.ink)),
                  if (e.synopsis.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(truncateWords(e.synopsis, 20), maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: AppType.body(size: 12.5, color: pal.muted)),
                  ],
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: rounded(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 6,
                      backgroundColor: pal.line,
                      color: AppPalette.terracotta,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text('Chương ${e.chapter} / ${e.totalChapters}',
                      style: AppType.meta(size: 11.5, color: pal.muted)),
                  const SizedBox(height: 6),
                  Row(children: [
                    if (e.genre.isNotEmpty)
                      Expanded(
                        child: Text(e.genre, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: AppType.meta(size: 11.5, color: pal.amber)),
                      )
                    else
                      const Spacer(),
                    if (e.reads.isNotEmpty)
                      Text('${e.reads} reads', style: AppType.meta(size: 11.5, color: pal.muted)),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Route** — `lib/router.dart`: import `'screens/novel/reading_history_screen.dart'` (đúng thứ tự alphabet nhóm novel) + sau route `/category/:id`:

```dart
    GoRoute(path: '/reading-history', builder: (_, __) => const ReadingHistoryScreen()),
```

- [ ] **Step 3: Verify** — analyze 0/0 + full test PASS.

- [ ] **Step 4: Commit + push**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/screens/novel/reading_history_screen.dart lib/router.dart
git commit -m "feat(novel): màn /reading-history — danh sách đang đọc dở (card theo spec)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 4: Reader — ghi history local + push sync

**Files:**
- Modify: `lib/screens/novel/reader_screen.dart` (import + mở rộng `_recordLastRead`)

**Interfaces:**
- Consumes: `ReadingHistoryStore.record` (Task 2), `HistoryRepository.sync` (Task 1), `AuthNotifier.user`, `Book` (title/cover/synopsis/genre/reads/chapters/uuid), `Chapter.id/n`.
- Produces: không.

- [ ] **Step 1: Import** (cạnh các import data hiện có):

```dart
import '../../data/reading_history/reading_history_store.dart';
import '../../data/repositories/history_repository.dart';
import '../../state/auth_notifier.dart';
```

- [ ] **Step 2: Mở rộng `_recordLastRead`** — hàm hiện tại (dòng ~235) gọi `context.read<AppState>().setLastRead(...)`; GIỮ NGUYÊN phần đó và THÊM vào cuối hàm:

```dart
    // Lịch sử đọc local-first (nguồn màn "Đang đọc" + Continue Reading More).
    context.read<ReadingHistoryStore>().record(ReadingHistoryEntry(
          bookId: b.id, storyUuid: b.uuid, title: b.title, cover: b.cover,
          synopsis: b.synopsis, genre: b.genre, reads: b.reads,
          totalChapters: b.chapters, chapter: ch.n,
          savedAt: DateTime.now().millisecondsSinceEpoch,
        ));
    // Sync ngầm lên BE — CHỈ khi đã đăng nhập + đủ định danh; lỗi nuốt.
    final auth = context.read<AuthNotifier>();
    final uuid = b.uuid;
    if (auth.user != null && uuid != null && uuid.isNotEmpty && ch.id.isNotEmpty) {
      final history = context.read<HistoryRepository>();
      unawaited(() async {
        try { await history.sync(storyUuid: uuid, chapterId: ch.id); } catch (_) {/* offline/lỗi → thôi */}
      }());
    }
```

(`unawaited` — `dart:async` đã import sẵn trong reader. `_recordLastRead(ch)` được gọi với `ch` có `id`/`n` — xem chữ ký hiện tại, giữ nguyên.)

- [ ] **Step 3: Verify** — analyze 0/0 + full test PASS.

- [ ] **Step 4: Commit + push**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/screens/novel/reader_screen.dart
git commit -m "feat(reader): ghi lịch sử đọc local + push /history/sync khi đã đăng nhập

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 5: Home — banner carousel + More... + pull-merge

**Files:**
- Create: `lib/screens/novel/widgets/home_banner_carousel.dart`
- Modify: `lib/screens/novel/novel_home_screen.dart` (import, state `_banners`, load trong `_loadHomeFeeds`, chèn carousel, header Continue Reading thêm More..., pull-merge khi login), `pubspec.yaml` (url_launcher)

**Interfaces:**
- Consumes: `BannersRepository.list`/`AppBanner` (Task 1), `ReadingHistoryStore` + `mergeHistory` (Task 2), `HistoryRepository.list` (Task 1), route `/reading-history` (Task 3), `AuthNotifier.user`.
- Produces: `HomeBannerCarousel(banners: List<AppBanner>)` widget.

- [ ] **Step 1: pubspec** — dưới `share_plus`:

```yaml
  url_launcher: ^6.3.1
```

Run `"/d/SetupC/flutter/bin/flutter.bat" pub get`.

- [ ] **Step 2: Tạo `lib/screens/novel/widgets/home_banner_carousel.dart`:**

```dart
import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../data/repositories/banners_repository.dart';
import '../../../theme/app_dimens.dart';
import '../../../theme/app_palette.dart';

/// Carousel banner Home (admin quản qua BE /banners, position home_hero).
/// Tự trượt 5s + chấm trang; 1 banner thì đứng yên. Bấm: linkUrl chứa
/// '/story/' → mở chi tiết truyện trong app; link khác → trình duyệt ngoài.
class HomeBannerCarousel extends StatefulWidget {
  const HomeBannerCarousel({super.key, required this.banners});
  final List<AppBanner> banners;

  @override
  State<HomeBannerCarousel> createState() => _HomeBannerCarouselState();
}

class _HomeBannerCarouselState extends State<HomeBannerCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    if (widget.banners.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!mounted || !_controller.hasClients) return;
        final next = (_page + 1) % widget.banners.length;
        _controller.animateToPage(next, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _open(AppBanner b) {
    final link = b.linkUrl;
    if (link == null) return;
    final storyIdx = link.indexOf('/story/');
    if (storyIdx >= 0) {
      final slug = link.substring(storyIdx + '/story/'.length).split('/').first.split('?').first;
      if (slug.isNotEmpty) {
        context.push('/book/$slug');
        return;
      }
    }
    final uri = Uri.tryParse(link);
    if (uri != null) {
      launchUrl(uri, mode: LaunchMode.externalApplication).catchError((_) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.lg, Gap.screenH, 0),
      child: Column(children: [
        AspectRatio(
          aspectRatio: 2.5,
          child: ClipRRect(
            borderRadius: rounded(18),
            child: PageView.builder(
              controller: _controller,
              onPageChanged: (i) => setState(() => _page = i),
              itemCount: widget.banners.length,
              itemBuilder: (_, i) {
                final b = widget.banners[i];
                return GestureDetector(
                  onTap: () => _open(b),
                  child: CachedNetworkImage(
                    imageUrl: b.imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(color: pal.surf),
                    errorWidget: (_, __, ___) => Container(color: pal.surf),
                  ),
                );
              },
            ),
          ),
        ),
        if (widget.banners.length > 1) ...[
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < widget.banners.length; i++)
              Container(
                width: i == _page ? 16 : 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  color: i == _page ? AppPalette.terracotta : pal.line,
                  borderRadius: rounded(3),
                ),
              ),
          ]),
        ],
      ]),
    );
  }
}
```

- [ ] **Step 3: Home wiring** — `novel_home_screen.dart`:

3a. Imports:

```dart
import '../../data/reading_history/reading_history_store.dart';
import '../../data/repositories/banners_repository.dart';
import '../../data/repositories/history_repository.dart';
import '../../state/auth_notifier.dart';
import 'widgets/home_banner_carousel.dart';
```

3b. State (cạnh `_trending`):

```dart
  List<AppBanner> _banners = const [];
  bool _historyPulled = false; // pull-merge BE 1 lần mỗi phiên (khi đã login)
```

3c. Trong `_loadHomeFeeds`, thêm vào `Future.wait([...])` 2 phần tử: `_loadBanners()` và `_pullHistory()`. Thêm 2 method sau `_loadShelves`:

```dart
  Future<void> _loadBanners() async {
    try {
      final list = await context.read<BannersRepository>().list();
      if (mounted) setState(() => _banners = list);
    } catch (_) {/* rỗng/lỗi → ẩn carousel */}
  }

  /// Pull lịch sử BE + merge vào store local — 1 lần mỗi phiên, chỉ khi đã login.
  Future<void> _pullHistory() async {
    if (_historyPulled) return;
    final auth = context.read<AuthNotifier>();
    if (auth.user == null) return;
    _historyPulled = true;
    try {
      final store = context.read<ReadingHistoryStore>();
      final remote = await context.read<HistoryRepository>().list();
      final merged = mergeHistory(store.entries(), remote);
      for (final e in merged) {
        await store.record(e);
      }
      if (mounted) setState(() {}); // refresh nút More nếu vừa có history
    } catch (_) {/* offline/lỗi → thôi, local vẫn đủ */}
  }
```

3d. Chèn carousel trong `_content` — NGAY TRƯỚC `_editorHero(...)`:

```dart
          if (_banners.isNotEmpty) HomeBannerCarousel(banners: _banners),
```

3e. Header Continue Reading — thay:

```dart
            _sectionHeader(context, 'Continue Reading'),
```

bằng:

```dart
            _sectionHeader(
              context, 'Continue Reading',
              onMore: context.read<ReadingHistoryStore>().entries().isNotEmpty
                  ? () => context.push('/reading-history')
                  : null,
              moreLabel: 'More...',
            ),
```

- [ ] **Step 4: Verify** — analyze 0/0 (không info MỚI — nếu url_launcher/deprecated gì thì xử lý theo API hiện hành) + full test PASS.

- [ ] **Step 5: Commit + push**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add pubspec.yaml pubspec.lock lib/screens/novel/widgets/home_banner_carousel.dart lib/screens/novel/novel_home_screen.dart
git commit -m "feat(novel): banner carousel + More... Continue Reading + pull-merge history khi login

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

### Task 6: Verify toàn bộ + docs

**Files:**
- Modify: `CHANGELOG.md` (section mới trong entry 2026-07-17 — tạo entry nếu chưa có), `lib/screens/novel/README.md` (row home + row màn mới), `lib/data/README.md` (3 row mới)

- [ ] **Step 1: Full verify** — `flutter test` ALL pass; `flutter analyze` 0 err/0 warn (53 info pre-existing).

- [ ] **Step 2: `CHANGELOG.md`** — thêm entry (TRÊN entry 2026-07-15; nếu đã có `## 2026-07-17` thì thêm section vào đó):

```markdown
## 2026-07-17

### Home v2 — Banner + Đọc tiếp
- **Banner carousel** (`GET /banners`, admin quản): tự trượt 5s + chấm trang, dưới header Reading; bấm mở truyện trong app (link `/story/`) hoặc trình duyệt (`url_launcher`). Rỗng/lỗi → ẩn.
- **Lịch sử đọc local-first**: Hive box `readingHistory` (50 truyện gần nhất) ghi ngay khi mở chương — khách hay có tài khoản đều như nhau.
- **Continue Reading** thêm **"More..."** (cùng cột View All) → màn **`/reading-history`**: mỗi truyện 1 hàng — thumb trái to, tiêu đề, tóm tắt 20 từ, progress bar, "Chương x / y", thể loại + lượt đọc; bấm đọc tiếp đúng chương.
- **Sync ngầm 2 chiều** khi đã đăng nhập: đọc chương → `POST /history/sync`; mở Home → `GET /history` merge vào local (bên mới hơn thắng). Khách = local-only.
```

- [ ] **Step 3: README rows** — `lib/screens/novel/README.md`: cập nhật row home (thêm "banner carousel; Continue Reading + More → /reading-history") + row mới `reading_history_screen.dart`; `lib/data/README.md`: 3 row (`banners_repository`, `history_repository`, `reading_history/reading_history_store`).

- [ ] **Step 4: Commit + push**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add CHANGELOG.md lib/screens/novel/README.md lib/data/README.md
git commit -m "docs: Home v2 banner + đọc tiếp (CHANGELOG + README)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```
