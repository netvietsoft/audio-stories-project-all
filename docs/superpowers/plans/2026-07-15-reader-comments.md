# Reader Comments + Support/Share Implementation Plan

> ĐÍNH CHÍNH sau final review: list BE trả {data:{comments|replies:[...]},meta}; create/toggle bị double-wrap → repo phải bóc thêm 1 lớp data. Code đã sửa tolerant 2 shape.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reader có bình luận thật theo đoạn (bubble + long-press) và theo chương (replies lồng + reactions), nút Support tặng Pulse thật qua BE, nút Share chia sẻ link web của chương.

**Architecture:** `CommentsRepository` mới (list/replies/create/toggle/report) + util anchor thuần Dart port nguyên văn từ web (match comment↔đoạn app, anchor-first index-fallback). Sheet comment là widget file riêng dùng chung cho 2 scope. Reader chỉ wiring: load paragraph comments online, bubble dưới đoạn, long-press, 3 nút cuối chương nối thật. Gift qua `POST /stories/:id/gift` (cần UUID truyện → `Book` thêm field `uuid`). Share qua `share_plus` với URL canonical của web.

**Tech Stack:** Flutter, provider, go_router, dio (đã có); dep MỚI duy nhất: `share_plus`.

**Spec:** `docs/superpowers/specs/2026-07-15-reader-comments-design.md`

## Global Constraints

- Dep mới DUY NHẤT: `share_plus: ^10.1.2`. KHÔNG sửa BE.
- Endpoint chính xác: `GET/POST /chapters/:chapterId/comments` · `GET /comments/:id/replies` · `POST /comments/:id/reactions` (`type: helpful|like|love`) · `POST /comments/:id/report` · `POST /stories/:id/gift` (`{amount≥1, message?, chapterId?}` — `:id` là **UUID**, không phải slug).
- Response comment (đã unwrap): `{id, content, createdAt, likesCount, paragraphIndex(null=cấp chương), paragraphAnchor|null, user{id,displayName,avatarUrl|null}, reactions{helpful,like,love}, repliesCount}`. Toggle reaction trả (đã unwrap) `{commentId, toggledOn, type, reactions{...}}`.
- Anchor: thuật toán §2 spec — PHẢI giống byte-identical bản JS (strip tag → strip entity → non-`\p{L}\p{N}` → space → trim → lowercase → cắt 100).
- Share URL: `https://dreamtap.me/story/{slug}/chuong-{N}` (webBaseUrl hằng trong api_env.dart, KHÔNG kèm segment ngôn ngữ).
- Auth gate: thao tác ghi (gửi comment/reaction/report/gift) khi `AuthNotifier.user == null` → đóng sheet + `context.push('/login')`.
- Đọc OFFLINE/local-first: không load comment, bubble ẩn (fire-and-forget, lỗi nuốt).
- KHÔNG đụng: read-along, resume/bookmark, settings sheet, top bar, Prev/Next, `showUnlockSheet`/`showRatingSheet`.
- Flutter KHÔNG trong PATH → `"/d/SetupC/flutter/bin/flutter.bat"` (bash).
- Git repo `D:\SetupC\Projects\NovelApp\novelverse` (master); commit mỗi task, body kết `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: CommentsRepository + endpoints + provider

**Files:**
- Modify: `lib/api/api_endpoints.dart` (thêm nhóm Comments sau `chapterAudio`)
- Create: `lib/data/repositories/comments_repository.dart`
- Modify: `lib/main.dart` (3 chỗ theo pattern `categoriesRepo`: dòng ~65 tạo instance, ~120 field, ~136 `Provider.value`)
- Test: `test/data/comments_repository_test.dart` (tạo mới)

**Interfaces:**
- Produces: model `ChapterComment {id, content, createdAt: String, paragraphIndex: int?, paragraphAnchor: String?, userName, avatarUrl: String?, reactions: Map<String,int>, repliesCount: int}` + `withReactions(Map<String,int>)`; `CommentPage {items, page, lastPage, total, hasMore}`; `CommentsRepository.paragraphAll(chapterId) → Future<List<ChapterComment>>`, `.chapterPage(chapterId, {page, limit, sort}) → Future<CommentPage>`, `.replies(commentId, {page, limit}) → Future<CommentPage>`, `.create(chapterId, {content, parentId, scope, paragraphIndex, paragraphAnchor}) → Future<ChapterComment>`, `.toggleReaction(commentId, type) → Future<Map<String,int>>` (reactions mới), `.report(commentId, reason) → Future<void>`. Task 3/4 dùng đúng các tên này.

- [ ] **Step 1: Viết test thất bại** — tạo `test/data/comments_repository_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/repositories/comments_repository.dart';

/// ApiClient giả: trả response cố định, ghi lại path/query/body.
class _FakeApi extends ApiClient {
  _FakeApi(this.response);
  final dynamic response;
  String? lastPath;
  Map<String, dynamic>? lastQuery;
  Map<String, dynamic>? lastBody;
  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool raw = false}) async {
    lastPath = path; lastQuery = query;
    return response;
  }
  @override
  Future<dynamic> post(String path, {Map<String, dynamic>? body, Map<String, String>? headers}) async {
    lastPath = path; lastBody = body;
    return response;
  }
}

const _cmt = {
  'id': 'c1', 'content': 'Hay quá', 'createdAt': '2026-07-15T10:00:00.000Z', 'likesCount': 2,
  'paragraphIndex': 3, 'paragraphAnchor': 'hay qua doan nay',
  'user': {'id': 'u1', 'displayName': 'Tí', 'avatarUrl': null},
  'reactions': {'helpful': 2, 'like': 1, 'love': 0}, 'repliesCount': 4,
};

void main() {
  test('paragraphAll: đúng path + query, parse shape đủ field', () async {
    final api = _FakeApi({'data': [_cmt], 'meta': {'total': 1}});
    final repo = CommentsRepository(api);
    final list = await repo.paragraphAll('ch1');
    expect(api.lastPath, '/chapters/ch1/comments');
    expect(api.lastQuery?['scope'], 'paragraph');
    expect(api.lastQuery?['allParagraphs'], 'true');
    final c = list.single;
    expect(c.id, 'c1');
    expect(c.paragraphIndex, 3);
    expect(c.paragraphAnchor, 'hay qua doan nay');
    expect(c.userName, 'Tí');
    expect(c.avatarUrl, isNull);
    expect(c.reactions['helpful'], 2);
    expect(c.repliesCount, 4);
  });

  test('chapterPage: meta phân trang + comment cấp chương (paragraphIndex null)', () async {
    final api = _FakeApi({
      'data': [{..._cmt, 'paragraphIndex': null, 'paragraphAnchor': null, 'reactions': null}],
      'meta': {'page': 2, 'lastPage': 5, 'total': 99},
    });
    final repo = CommentsRepository(api);
    final pageData = await repo.chapterPage('ch1', page: 2, sort: 'helpful');
    expect(api.lastQuery?['scope'], 'chapter');
    expect(api.lastQuery?['sort'], 'helpful');
    expect(pageData.page, 2);
    expect(pageData.lastPage, 5);
    expect(pageData.hasMore, isTrue);
    expect(pageData.items.single.paragraphIndex, isNull);
    expect(pageData.items.single.reactions, {'helpful': 0, 'like': 0, 'love': 0}); // reactions null → 0 hết
  });

  test('create: gửi đủ body; toggleReaction: đọc reactions mới; report: đúng path', () async {
    final api = _FakeApi(_cmt);
    final repo = CommentsRepository(api);
    await repo.create('ch1', content: 'hi', parentId: 'p1', scope: 'paragraph', paragraphIndex: 2, paragraphAnchor: 'abc');
    expect(api.lastPath, '/chapters/ch1/comments');
    expect(api.lastBody, {'content': 'hi', 'parentId': 'p1', 'scope': 'paragraph', 'paragraphIndex': 2, 'paragraphAnchor': 'abc'});

    final api2 = _FakeApi({'commentId': 'c1', 'toggledOn': true, 'type': 'love', 'reactions': {'helpful': 0, 'like': 1, 'love': 7}});
    final repo2 = CommentsRepository(api2);
    final r = await repo2.toggleReaction('c1', 'love');
    expect(api2.lastPath, '/comments/c1/reactions');
    expect(api2.lastBody, {'type': 'love'});
    expect(r['love'], 7);

    final api3 = _FakeApi(const {});
    final repo3 = CommentsRepository(api3);
    await repo3.report('c1', 'spam');
    expect(api3.lastPath, '/comments/c1/report');
    expect(api3.lastBody, {'reason': 'spam'});
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/comments_repository_test.dart`
Expected: FAIL compile — `comments_repository.dart` chưa tồn tại.
LƯU Ý kiểm tra chữ ký `ApiClient.post` thật trong `lib/api/api_client.dart` — nếu named params khác (`body`/`headers`), chỉnh `_FakeApi.post` override cho khớp (giữ nguyên hành vi ghi lại `lastBody`).

- [ ] **Step 3a: Endpoints** — `lib/api/api_endpoints.dart`, sau dòng `static String chapterAudio(...)`:

```dart

  // ── Comments (chương/đoạn) ──
  static String chapterComments(String chapterId) => '/chapters/$chapterId/comments';
  static String commentReplies(String commentId) => '/comments/$commentId/replies';
  static String commentReactions(String commentId) => '/comments/$commentId/reactions';
  static String commentReport(String commentId) => '/comments/$commentId/report';
```

- [ ] **Step 3b: Tạo `lib/data/repositories/comments_repository.dart`:**

```dart
import '../../api/api_client.dart';
import '../../api/api_endpoints.dart';

/// 1 bình luận chương/đoạn (shape serializeComment của BE chapter-comments).
class ChapterComment {
  const ChapterComment({
    required this.id,
    required this.content,
    required this.createdAt,
    required this.paragraphIndex,
    required this.paragraphAnchor,
    required this.userName,
    required this.avatarUrl,
    required this.reactions,
    required this.repliesCount,
  });

  final String id, content, createdAt, userName;
  final String? avatarUrl, paragraphAnchor;
  /// null = comment cấp CHƯƠNG.
  final int? paragraphIndex;
  /// helpful/like/love → count.
  final Map<String, int> reactions;
  final int repliesCount;

  factory ChapterComment.fromJson(Map<String, dynamic> j) {
    final u = j['user'];
    final r = j['reactions'];
    return ChapterComment(
      id: (j['id'] ?? '').toString(),
      content: (j['content'] ?? '').toString(),
      createdAt: (j['createdAt'] ?? '').toString(),
      paragraphIndex: j['paragraphIndex'] is num ? (j['paragraphIndex'] as num).toInt() : null,
      paragraphAnchor: j['paragraphAnchor']?.toString(),
      userName: ((u is Map ? u['displayName'] : null) ?? 'Độc giả').toString(),
      avatarUrl: (u is Map ? u['avatarUrl'] : null)?.toString(),
      reactions: {
        for (final k in const ['helpful', 'like', 'love'])
          k: (r is Map && r[k] is num) ? (r[k] as num).toInt() : 0,
      },
      repliesCount: j['repliesCount'] is num ? (j['repliesCount'] as num).toInt() : 0,
    );
  }

  /// Bản copy với reactions mới (sau toggle).
  ChapterComment withReactions(Map<String, int> r) => ChapterComment(
        id: id, content: content, createdAt: createdAt,
        paragraphIndex: paragraphIndex, paragraphAnchor: paragraphAnchor,
        userName: userName, avatarUrl: avatarUrl,
        reactions: r, repliesCount: repliesCount,
      );
}

/// Trang comment + meta phân trang.
class CommentPage {
  const CommentPage({required this.items, required this.page, required this.lastPage, required this.total});
  final List<ChapterComment> items;
  final int page, lastPage, total;
  bool get hasMore => page < lastPage;
}

/// Bình luận chương/đoạn + replies + reactions (module chapter-comments BE).
class CommentsRepository {
  CommentsRepository(this._api);
  final ApiClient _api;

  /// TẤT CẢ comment cấp đoạn của 1 chương (allParagraphs=true → BE bỏ phân trang).
  Future<List<ChapterComment>> paragraphAll(String chapterId) async {
    final body = await _api.get(ApiEndpoints.chapterComments(chapterId), raw: true,
        query: {'scope': 'paragraph', 'allParagraphs': 'true'});
    return unwrapList(body)
        .whereType<Map>()
        .map((j) => ChapterComment.fromJson(Map<String, dynamic>.from(j)))
        .toList();
  }

  /// Comment cấp CHƯƠNG, phân trang. sort: newest | helpful.
  Future<CommentPage> chapterPage(String chapterId, {int page = 1, int limit = 20, String sort = 'newest'}) async {
    final body = await _api.get(ApiEndpoints.chapterComments(chapterId), raw: true,
        query: {'scope': 'chapter', 'page': page, 'limit': limit, 'sort': sort});
    return _page(body, page);
  }

  /// Replies của 1 comment, phân trang.
  Future<CommentPage> replies(String commentId, {int page = 1, int limit = 20}) async {
    final body = await _api.get(ApiEndpoints.commentReplies(commentId), raw: true,
        query: {'page': page, 'limit': limit});
    return _page(body, page);
  }

  /// Đăng comment/reply (cần đăng nhập — Bearer tự gắn). Trả comment vừa tạo.
  Future<ChapterComment> create(String chapterId, {
    required String content,
    String? parentId,
    String scope = 'chapter',
    int? paragraphIndex,
    String? paragraphAnchor,
  }) async {
    final data = await _api.post(ApiEndpoints.chapterComments(chapterId), body: {
      'content': content,
      if (parentId != null) 'parentId': parentId,
      'scope': scope,
      if (paragraphIndex != null) 'paragraphIndex': paragraphIndex,
      if (paragraphAnchor != null) 'paragraphAnchor': paragraphAnchor,
    });
    return ChapterComment.fromJson(Map<String, dynamic>.from(data as Map));
  }

  /// Toggle reaction (helpful|like|love). BE trả reactions MỚI → dùng luôn.
  Future<Map<String, int>> toggleReaction(String commentId, String type) async {
    final data = await _api.post(ApiEndpoints.commentReactions(commentId), body: {'type': type});
    final m = data is Map ? data : const {};
    final r = m['reactions'] is Map ? m['reactions'] as Map : m;
    return {
      for (final k in const ['helpful', 'like', 'love'])
        k: (r[k] is num) ? (r[k] as num).toInt() : 0,
    };
  }

  /// Báo cáo comment (cần đăng nhập).
  Future<void> report(String commentId, String reason) =>
      _api.post(ApiEndpoints.commentReport(commentId), body: {'reason': reason});

  CommentPage _page(dynamic body, int fallbackPage) {
    final list = unwrapList(body);
    final meta = unwrapMeta(body);
    int i(dynamic v, int d) => v is num ? v.toInt() : d;
    return CommentPage(
      items: list.whereType<Map>().map((j) => ChapterComment.fromJson(Map<String, dynamic>.from(j))).toList(),
      page: i(meta?['page'], fallbackPage),
      lastPage: i(meta?['lastPage'], fallbackPage),
      total: i(meta?['total'], list.length),
    );
  }
}
```

- [ ] **Step 3c: Provider** — `lib/main.dart`, 3 chỗ theo đúng pattern `categoriesRepo`:
  - Sau dòng `final categoriesRepo = CategoriesRepository(apiClient, cache);` thêm: `final commentsRepo = CommentsRepository(apiClient);`
  - Thêm import `'data/repositories/comments_repository.dart'` (cạnh import categories_repository), truyền `commentsRepo` qua constructor App như `categoriesRepo` (field + tham số), và trong `MultiProvider` sau `Provider.value(value: categoriesRepo),` thêm `Provider.value(value: commentsRepo),`.

- [ ] **Step 4: Chạy test → PASS (cả suite data)**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/`
Expected: PASS toàn bộ (3 test mới + test cũ).

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/api/api_endpoints.dart lib/data/repositories/comments_repository.dart lib/main.dart test/data/comments_repository_test.dart
git commit -m "feat(data): CommentsRepository — list/replies/create/toggle/report cho reader

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Anchor util — makeAnchor + matchCommentsToParagraphs

**Files:**
- Create: `lib/data/comments/paragraph_anchor.dart`
- Test: `test/data/paragraph_anchor_test.dart` (tạo mới)

**Interfaces:**
- Consumes (Task 1): `ChapterComment` (đọc `paragraphAnchor`, `paragraphIndex`).
- Produces: `String makeAnchor(String s)`; `Map<int, List<ChapterComment>> matchCommentsToParagraphs(List<ChapterComment> comments, List<String> paras)`. Task 4 dùng cả hai.

- [ ] **Step 1: Viết test thất bại** — tạo `test/data/paragraph_anchor_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/comments/paragraph_anchor.dart';
import 'package:novelverse/data/repositories/comments_repository.dart';

ChapterComment _c({String? anchor, int? idx}) => ChapterComment(
      id: 'x', content: 'nd', createdAt: '', paragraphIndex: idx, paragraphAnchor: anchor,
      userName: 'u', avatarUrl: null, reactions: const {'helpful': 0, 'like': 0, 'love': 0}, repliesCount: 0);

void main() {
  test('makeAnchor: giữ chữ tiếng Việt có dấu, dấu câu/xuống dòng → space, lowercase, cắt 100', () {
    expect(makeAnchor('"Anh yêu em," cô nói.\nRồi đi.'), 'anh yêu em cô nói rồi đi');
    expect(makeAnchor('<p>Hello &nbsp; <b>World</b>!</p>'), 'hello world');
    final long = List.filled(40, 'chữ').join(' '); // 40*3 + 39 = 159 ký tự normalize
    expect(makeAnchor(long).length, 100);
  });

  test('match: anchor khớp chính xác → đúng đoạn', () {
    final paras = ['Đoạn một nội dung.', 'Đoạn hai nội dung khác.'];
    final m = matchCommentsToParagraphs([_c(anchor: makeAnchor(paras[1]), idx: 0)], paras);
    expect(m[1], hasLength(1)); // anchor thắng index sai
    expect(m[0], isNull);
  });

  test('match: anchor web DÀI hơn (chunk gộp ≥250 từ) vẫn khớp đoạn đầu chunk', () {
    final paras = ['Câu mở đầu của chunk.', 'Phần sau của chunk cũ.'];
    // anchor web = normalize cả chunk (đoạn 0 + đoạn 1) — startsWith anchor đoạn 0
    final webAnchor = makeAnchor('${paras[0]} ${paras[1]}');
    final m = matchCommentsToParagraphs([_c(anchor: webAnchor, idx: 99)], paras);
    expect(m[0], hasLength(1));
  });

  test('match: anchor null/rỗng → fallback index (clamp)', () {
    final paras = ['a', 'b'];
    final m = matchCommentsToParagraphs([_c(anchor: null, idx: 7), _c(anchor: '', idx: null)], paras);
    expect(m[1], hasLength(1)); // idx 7 clamp → 1
    expect(m[0], hasLength(1)); // idx null → 0
  });
}
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/paragraph_anchor_test.dart`
Expected: FAIL compile — file chưa tồn tại.

- [ ] **Step 3: Tạo `lib/data/comments/paragraph_anchor.dart`:**

```dart
import '../repositories/comments_repository.dart';

/// Thuật toán anchor ĐỒNG NHẤT với web FE + backfill BE
/// (`backend-port/be/prisma/backfill-paragraph-anchor.ts` — "byte-identical to FE"):
/// strip tag → strip HTML entity → mọi ký tự KHÔNG chữ/số (Unicode, giữ dấu
/// tiếng Việt) → space → trim → lowercase → cắt 100 ký tự.
String makeAnchor(String s) {
  final norm = s
      .replaceAll(RegExp(r'<[^>]*>'), ' ')
      .replaceAll(RegExp(r'&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);'), ' ')
      .replaceAll(RegExp(r'[^\p{L}\p{N}]+', unicode: true), ' ')
      .trim()
      .toLowerCase();
  return norm.length <= 100 ? norm : norm.substring(0, 100);
}

/// Group comment cấp đoạn vào INDEX ĐOẠN CỦA APP (paras = đoạn đã trim, đúng thứ
/// tự render). Anchor-first — prefix 2 CHIỀU vì web gộp đoạn ≥250 từ nên anchor
/// web có thể dài hơn anchor đoạn app (và ngược lại đoạn app dài → anchor đoạn
/// dài hơn anchor comment cắt 100). Không match → fallback paragraphIndex (clamp).
Map<int, List<ChapterComment>> matchCommentsToParagraphs(
    List<ChapterComment> comments, List<String> paras) {
  final anchors = [for (final p in paras) makeAnchor(p)];
  final out = <int, List<ChapterComment>>{};
  for (final c in comments) {
    var idx = -1;
    final a = c.paragraphAnchor ?? '';
    if (a.isNotEmpty) {
      for (var i = 0; i < anchors.length; i++) {
        final p = anchors[i];
        if (p.isNotEmpty && (a.startsWith(p) || p.startsWith(a))) {
          idx = i;
          break;
        }
      }
    }
    if (idx < 0) {
      if (paras.isEmpty) continue;
      idx = (c.paragraphIndex ?? 0).clamp(0, paras.length - 1);
    }
    (out[idx] ??= []).add(c);
  }
  return out;
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/paragraph_anchor_test.dart`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/data/comments/paragraph_anchor.dart test/data/paragraph_anchor_test.dart
git commit -m "feat(data): anchor đoạn tương thích web (makeAnchor + match anchor-first/index-fallback)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Widget sheet bình luận dùng chung

**Files:**
- Create: `lib/screens/novel/widgets/comments_sheet.dart`

**Interfaces:**
- Consumes (Task 1): `CommentsRepository` (qua `context.read`), model `ChapterComment`/`CommentPage`; `AuthNotifier.user` (null = chưa đăng nhập).
- Produces: `Future<void> showChapterCommentsSheet(BuildContext context, {required String chapterId, required String scope, int? paragraphIndex, String? paragraphAnchor, List<ChapterComment> initial, void Function(ChapterComment created)? onCreated})` — Task 4 gọi từ bubble/long-press (`scope: 'paragraph'`) và nút Comment cuối chương (`scope: 'chapter'`).

- [ ] **Step 1: Tạo `lib/screens/novel/widgets/comments_sheet.dart`** (file đầy đủ):

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../data/repositories/comments_repository.dart';
import '../../../state/auth_notifier.dart';
import '../../../theme/app_dimens.dart';
import '../../../theme/app_palette.dart';
import '../../../theme/app_type.dart';

/// Sheet bình luận dùng chung cho 2 scope:
/// - 'chapter': list phân trang (infinite scroll) + sort Mới nhất/Hữu ích.
/// - 'paragraph': list từ [initial] (Reader đã group theo đoạn), không phân trang.
/// Viết comment/reply/reaction/report yêu cầu đăng nhập → đẩy /login.
Future<void> showChapterCommentsSheet(
  BuildContext context, {
  required String chapterId,
  required String scope,
  int? paragraphIndex,
  String? paragraphAnchor,
  List<ChapterComment> initial = const [],
  void Function(ChapterComment created)? onCreated,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: context.pal.card,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (c, controller) => _CommentsSheetBody(
        chapterId: chapterId,
        scope: scope,
        paragraphIndex: paragraphIndex,
        paragraphAnchor: paragraphAnchor,
        initial: initial,
        onCreated: onCreated,
        scrollController: controller,
      ),
    ),
  );
}

class _CommentsSheetBody extends StatefulWidget {
  const _CommentsSheetBody({
    required this.chapterId,
    required this.scope,
    required this.paragraphIndex,
    required this.paragraphAnchor,
    required this.initial,
    required this.onCreated,
    required this.scrollController,
  });
  final String chapterId, scope;
  final int? paragraphIndex;
  final String? paragraphAnchor;
  final List<ChapterComment> initial;
  final void Function(ChapterComment)? onCreated;
  final ScrollController scrollController;

  @override
  State<_CommentsSheetBody> createState() => _CommentsSheetBodyState();
}

class _CommentsSheetBodyState extends State<_CommentsSheetBody> {
  late List<ChapterComment> _items = List.of(widget.initial);
  final Map<String, List<ChapterComment>> _replies = {}; // commentId → replies đã mở
  final _input = TextEditingController();
  ChapterComment? _replyTo;
  String _sort = 'newest';
  int _page = 0;
  bool _hasMore = true, _loading = false, _sending = false;

  bool get _isChapterScope => widget.scope == 'chapter';
  CommentsRepository get _repo => context.read<CommentsRepository>();

  @override
  void initState() {
    super.initState();
    if (_isChapterScope) {
      _hasMore = true;
      _loadMore();
      widget.scrollController.addListener(_onScroll);
    } else {
      _hasMore = false;
    }
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  void _onScroll() {
    final sc = widget.scrollController;
    if (!sc.hasClients || _loading || !_hasMore) return;
    if (sc.position.pixels >= sc.position.maxScrollExtent - 300) _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    try {
      final p = await _repo.chapterPage(widget.chapterId, page: _page + 1, sort: _sort);
      if (!mounted) return;
      setState(() {
        _items.addAll(p.items);
        _page = p.page;
        _hasMore = p.hasMore;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _hasMore = false; });
    }
  }

  void _changeSort(String s) {
    if (_sort == s) return;
    setState(() { _sort = s; _items = []; _page = 0; _hasMore = true; });
    _loadMore();
  }

  /// true nếu đã đăng nhập; false → đóng sheet + đẩy /login.
  bool _requireLogin() {
    if (context.read<AuthNotifier>().user != null) return true;
    Navigator.of(context).pop();
    context.push('/login');
    return false;
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending || !_requireLogin()) return;
    setState(() => _sending = true);
    try {
      final created = await _repo.create(
        widget.chapterId,
        content: text,
        parentId: _replyTo?.id,
        scope: _replyTo != null ? 'chapter' : widget.scope, // reply kế thừa scope của BE theo parent
        paragraphIndex: _replyTo == null ? widget.paragraphIndex : null,
        paragraphAnchor: _replyTo == null ? widget.paragraphAnchor : null,
      );
      if (!mounted) return;
      setState(() {
        if (_replyTo != null) {
          (_replies[_replyTo!.id] ??= []).add(created);
        } else {
          _items.insert(0, created);
          widget.onCreated?.call(created);
        }
        _replyTo = null;
        _input.clear();
        _sending = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gửi bình luận thất bại — thử lại')));
    }
  }

  Future<void> _toggle(ChapterComment c, String type, {String? parentOf}) async {
    if (!_requireLogin()) return;
    try {
      final r = await _repo.toggleReaction(c.id, type);
      if (!mounted) return;
      setState(() {
        if (parentOf != null) {
          final list = _replies[parentOf]!;
          final i = list.indexWhere((x) => x.id == c.id);
          if (i >= 0) list[i] = list[i].withReactions(r);
        } else {
          final i = _items.indexWhere((x) => x.id == c.id);
          if (i >= 0) _items[i] = _items[i].withReactions(r);
        }
      });
    } catch (_) {/* giữ count cũ */}
  }

  Future<void> _openReplies(ChapterComment c) async {
    if (_replies.containsKey(c.id)) return;
    try {
      final p = await _repo.replies(c.id, limit: 50);
      if (mounted) setState(() => _replies[c.id] = p.items);
    } catch (_) {/* im lặng */}
  }

  Future<void> _report(ChapterComment c) async {
    if (!_requireLogin()) return;
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Báo cáo bình luận'),
        content: TextField(controller: ctrl, decoration: const InputDecoration(hintText: 'Lý do')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(d, ctrl.text.trim()), child: const Text('Gửi')),
        ],
      ),
    );
    if (reason == null || reason.isEmpty || !mounted) return;
    try {
      await _repo.report(c.id, reason);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã gửi báo cáo')));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Báo cáo thất bại')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final title = _isChapterScope ? 'Bình luận chương' : 'Bình luận đoạn';
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(children: [
        const SizedBox(height: Gap.md),
        Container(width: 38, height: 4, decoration: BoxDecoration(color: pal.line, borderRadius: rounded(2))),
        Padding(
          padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.md, Gap.xl, 0),
          child: Row(children: [
            Text(title, style: AppType.section(color: pal.ink)),
            const SizedBox(width: 8),
            Text('${_items.length}${_hasMore ? '+' : ''}', style: AppType.meta(size: 12, color: pal.muted)),
            const Spacer(),
            if (_isChapterScope) ...[
              _sortChip('Mới nhất', 'newest'),
              const SizedBox(width: 6),
              _sortChip('Hữu ích', 'helpful'),
            ],
          ]),
        ),
        const SizedBox(height: Gap.sm),
        Expanded(
          child: _items.isEmpty && _loading
              ? const Center(child: CircularProgressIndicator(color: AppPalette.terracotta))
              : _items.isEmpty
                  ? Center(child: Text('Chưa có bình luận — hãy là người đầu tiên!', style: AppType.body(size: 13.5, color: pal.muted)))
                  : ListView.builder(
                      controller: widget.scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: Gap.xl, vertical: Gap.sm),
                      itemCount: _items.length + (_hasMore ? 1 : 0),
                      itemBuilder: (_, i) {
                        if (i >= _items.length) {
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Center(child: CircularProgressIndicator(color: AppPalette.terracotta)),
                          );
                        }
                        return _commentTile(_items[i]);
                      },
                    ),
        ),
        _inputBar(pal),
      ]),
    );
  }

  Widget _sortChip(String label, String value) {
    final sel = _sort == value;
    final pal = context.pal;
    return GestureDetector(
      onTap: () => _changeSort(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: sel ? AppPalette.terracotta : pal.surf2,
          borderRadius: rounded(14),
          border: Border.all(color: sel ? AppPalette.terracotta : pal.line),
        ),
        child: Text(label, style: AppType.btn(size: 11.5, color: sel ? Colors.white : pal.ink)),
      ),
    );
  }

  Widget _commentTile(ChapterComment c, {String? parentOf}) {
    final pal = context.pal;
    final replies = _replies[c.id];
    return Padding(
      padding: EdgeInsets.only(bottom: Gap.md, left: parentOf != null ? 36 : 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: pal.surf2,
            backgroundImage: c.avatarUrl != null && c.avatarUrl!.isNotEmpty ? NetworkImage(c.avatarUrl!) : null,
            child: c.avatarUrl == null || c.avatarUrl!.isEmpty
                ? Text(c.userName.isEmpty ? '?' : c.userName[0].toUpperCase(), style: AppType.item(size: 12, color: pal.ink))
                : null,
          ),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(c.userName, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 12.5, color: pal.ink))),
                const SizedBox(width: 6),
                Text(_timeAgo(c.createdAt), style: AppType.meta(size: 10.5, color: pal.muted)),
                const Spacer(),
                GestureDetector(onTap: () => _report(c), child: Icon(Icons.more_horiz, size: 16, color: pal.muted)),
              ]),
              const SizedBox(height: 2),
              Text(c.content, style: AppType.body(size: 13.5, color: pal.soft)),
              const SizedBox(height: 4),
              Row(children: [
                _reactionBtn(c, 'like', '👍', parentOf: parentOf),
                _reactionBtn(c, 'love', '❤️', parentOf: parentOf),
                _reactionBtn(c, 'helpful', '⭐', parentOf: parentOf),
                const SizedBox(width: Gap.md),
                if (parentOf == null)
                  GestureDetector(
                    onTap: () => setState(() => _replyTo = c),
                    child: Text('Trả lời', style: AppType.btn(size: 11.5, color: AppPalette.terracotta)),
                  ),
              ]),
              if (parentOf == null && c.repliesCount > 0 && replies == null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: GestureDetector(
                    onTap: () => _openReplies(c),
                    child: Text('Xem ${c.repliesCount} trả lời', style: AppType.btn(size: 11.5, color: pal.muted)),
                  ),
                ),
            ]),
          ),
        ]),
        if (replies != null) ...[
          const SizedBox(height: Gap.sm),
          for (final r in replies) _commentTile(r, parentOf: c.id),
        ],
      ]),
    );
  }

  Widget _reactionBtn(ChapterComment c, String type, String emoji, {String? parentOf}) {
    final n = c.reactions[type] ?? 0;
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.only(right: Gap.md),
      child: GestureDetector(
        onTap: () => _toggle(c, type, parentOf: parentOf),
        child: Text(n > 0 ? '$emoji $n' : emoji, style: AppType.meta(size: 11.5, color: pal.muted)),
      ),
    );
  }

  Widget _inputBar(dynamic pal) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, Gap.md),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_replyTo != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text('Trả lời @${_replyTo!.userName}', style: AppType.meta(size: 11, color: AppPalette.terracotta)),
                const SizedBox(width: 6),
                GestureDetector(onTap: () => setState(() => _replyTo = null), child: Icon(Icons.close, size: 14, color: pal.muted)),
              ]),
            ),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _input,
                maxLength: 5000,
                maxLines: 3,
                minLines: 1,
                decoration: InputDecoration(
                  counterText: '',
                  hintText: 'Viết bình luận…',
                  hintStyle: AppType.body(size: 13, color: pal.muted),
                  filled: true,
                  fillColor: pal.surf2,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(borderRadius: rounded(18), borderSide: BorderSide.none),
                ),
                style: AppType.body(size: 13.5, color: pal.ink),
              ),
            ),
            const SizedBox(width: Gap.sm),
            IconButton(
              onPressed: _sending ? null : _send,
              icon: _sending
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.terracotta))
                  : const Icon(Icons.send_rounded, color: AppPalette.terracotta),
            ),
          ]),
        ]),
      ),
    );
  }

  /// Thời gian tương đối ngắn gọn từ ISO string; hỏng → chuỗi rỗng.
  String _timeAgo(String iso) {
    final t = DateTime.tryParse(iso);
    if (t == null) return '';
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return 'vừa xong';
    if (d.inMinutes < 60) return '${d.inMinutes} phút';
    if (d.inHours < 24) return '${d.inHours} giờ';
    if (d.inDays < 30) return '${d.inDays} ngày';
    return '${(d.inDays / 30).floor()} tháng';
  }
}
```

- [ ] **Step 2: Verify compile + suite**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 lỗi/0 cảnh báo (nếu analyzer báo `pal` dynamic ở `_inputBar` → đổi tham số thành kiểu palette thật của `context.pal` cho khớp codebase).
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS toàn bộ.

- [ ] **Step 3: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/screens/novel/widgets/comments_sheet.dart
git commit -m "feat(reader): sheet bình luận dùng chung (list/reply/reaction/report + auth gate)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Reader wiring — bubble + long-press + nút Comment

**Files:**
- Modify: `lib/screens/novel/reader_screen.dart` (import, state, `_loadContent`, `_body`, `_goChapter`, end-of-chapter)
- Modify: `lib/widgets/sheets.dart` (XOÁ hàm `showCommentSheet` — call-site duy nhất là reader)
- Modify: `lib/widgets/README.md` (bỏ mô tả `showCommentSheet` ở dòng bảng + dòng chi tiết)

**Interfaces:**
- Consumes: `showChapterCommentsSheet` (Task 3), `CommentsRepository.paragraphAll` (Task 1), `makeAnchor`/`matchCommentsToParagraphs` (Task 2).
- Produces: không.

- [ ] **Step 1: Import + state.** Thêm import (nhóm relative, cạnh import reader hiện có):

```dart
import '../../data/comments/paragraph_anchor.dart';
import '../../data/repositories/comments_repository.dart';
import 'widgets/comments_sheet.dart';
```

Thêm state (cạnh `_cues`/`_paraKeys`):

```dart
  String _chapterId = ''; // id chương đang hiển thị (cho comments/gift)
  List<String> _paras = const []; // đoạn đã trim+flatten — dùng chung render & comments
  Map<int, List<ChapterComment>> _paraComments = {}; // index đoạn → comments (rỗng khi offline/lỗi)
```

- [ ] **Step 2: `_loadContent`** — nơi hiện gán `_cues` từ `ChapterContent` (quanh `final c = await _repo.chapterContent(ch.id);`), thêm NGAY SAU khi `_content` được gán trong `setState`:

```dart
      _chapterId = ch.id;
      _paras = _content.split(RegExp(r'\n\s*\n')).map((p) => flattenHardBreaks(p.trim())).where((p) => p.isNotEmpty).toList();
```

và SAU `setState` đó gọi (fire-and-forget):

```dart
    _loadParaComments(); // online-only, lỗi → bubble ẩn
```

Thêm method mới (đặt cạnh `_loadContent`):

```dart
  /// Nạp comment cấp đoạn của chương (online). Lỗi/offline → map rỗng (bubble ẩn).
  Future<void> _loadParaComments() async {
    final chapterId = _chapterId;
    try {
      final all = await context.read<CommentsRepository>().paragraphAll(chapterId);
      if (!mounted || chapterId != _chapterId) return; // đã sang chương khác
      setState(() => _paraComments = matchCommentsToParagraphs(all, _paras));
    } catch (_) {
      if (mounted && chapterId == _chapterId) setState(() => _paraComments = {});
    }
  }
```

- [ ] **Step 3: `_body`** — thay khối paras + loop hiện tại:

```dart
    final paras = _content.split(RegExp(r'\n\s*\n')).map((p) => flattenHardBreaks(p.trim())).where((p) => p.isNotEmpty).toList();
```

bằng dùng state chung:

```dart
    final paras = _paras;
```

và trong loop, thay:

```dart
        for (var i = 0; i < paras.length; i++) ...[
          _paragraph(i, paras[i], base, ink, _paraKey(i)),
          if (i < paras.length - 1) const SizedBox(height: Gap.lg),
        ],
```

bằng:

```dart
        for (var i = 0; i < paras.length; i++) ...[
          // Long-press đoạn → viết/xem comment đoạn (không ảnh hưởng tap-center toggle chrome).
          GestureDetector(
            onLongPress: () => _openParaComments(i),
            child: _paragraph(i, paras[i], base, ink, _paraKey(i)),
          ),
          if (_paraComments[i]?.isNotEmpty == true)
            Align(
              alignment: Alignment.centerRight,
              child: GestureDetector(
                onTap: () => _openParaComments(i),
                child: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.mode_comment_outlined, size: 14, color: ink.withValues(alpha: 0.45)),
                    const SizedBox(width: 3),
                    Text('${_paraComments[i]!.length}', style: AppType.meta(size: 11, color: ink.withValues(alpha: 0.45))),
                  ]),
                ),
              ),
            ),
          if (i < paras.length - 1) const SizedBox(height: Gap.lg),
        ],
```

Thêm method:

```dart
  void _openParaComments(int i) {
    if (_chapterId.isEmpty || i >= _paras.length) return;
    showChapterCommentsSheet(
      context,
      chapterId: _chapterId,
      scope: 'paragraph',
      paragraphIndex: i,
      paragraphAnchor: makeAnchor(_paras[i]),
      initial: _paraComments[i] ?? const [],
      onCreated: (c) => setState(() => (_paraComments[i] ??= []).add(c)),
    );
  }
```

LƯU Ý: sheet đoạn nhận `initial` snapshot — comment người khác viết trong lúc sheet mở không tự về; chấp nhận v1.

- [ ] **Step 4: `_goChapter`** — chỗ reset `_activeCue`/`_paraKeys` hiện có, thêm:

```dart
    _paraComments = {};
    _paras = const [];
```

- [ ] **Step 5: Nút Comment cuối chương** — thay:

```dart
        card(Icons.mode_comment_outlined, 'Comment', () => showCommentSheet(context)),
```

bằng:

```dart
        card(Icons.mode_comment_outlined, 'Comment', () => showChapterCommentsSheet(context, chapterId: _chapterId, scope: 'chapter')),
```

- [ ] **Step 6: Xoá demo** — trong `lib/widgets/sheets.dart` XOÁ toàn bộ hàm `showCommentSheet` (call-site duy nhất đã thay ở Step 5; nếu hàm dùng import nào không còn ai dùng thì dọn import đó). Trong `lib/widgets/README.md`: bỏ `showCommentSheet` khỏi câu liệt kê "4 bottom-sheet dùng chung" (→ 3) và xoá dòng mô tả chi tiết của nó nếu có.

- [ ] **Step 7: Verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 lỗi/0 cảnh báo.
Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add lib/screens/novel/reader_screen.dart lib/widgets/sheets.dart lib/widgets/README.md
git commit -m "feat(reader): bubble comment theo đoạn + long-press + sheet chương thật (bỏ demo)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Support tặng quà thật + Share link web

**Files:**
- Modify: `lib/api/api_endpoints.dart` (thêm `storyGift`), `lib/api/api_env.dart` (thêm `webBaseUrl`), `lib/models/models.dart` (Book thêm `uuid`), `lib/data/mappers/book_mapper.dart` (đọc `j['id']`), `lib/data/repositories/stories_repository.dart` (method `giftPulse`), `lib/widgets/sheets.dart` (`showGiftSheet` nối thật), `lib/screens/novel/reader_screen.dart` (call-site Support + Share), `pubspec.yaml` (share_plus)
- Create: `lib/data/share_links.dart`
- Test: `test/data/gift_share_test.dart` (tạo mới)

**Interfaces:**
- Consumes: `AuthNotifier.user`/`refreshUser()`; `ApiException` (message lỗi BE — import `lib/api/api_exception.dart`).
- Produces: `StoriesRepository.giftPulse(String storyId, {required int amount, String? message, String? chapterId}) → Future<void>`; `Book.uuid: String?`; `buildChapterWebUrl(String storySlug, int chapterNumber) → String`; `showGiftSheet(BuildContext, {required String author, required String? storyUuid, String? chapterId})`.

- [ ] **Step 1: Viết test thất bại** — tạo `test/data/gift_share_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';
import 'package:novelverse/data/share_links.dart';

class _FakeApi extends ApiClient {
  String? lastPath;
  Map<String, dynamic>? lastBody;
  @override
  Future<dynamic> post(String path, {Map<String, dynamic>? body, Map<String, String>? headers}) async {
    lastPath = path; lastBody = body;
    return const {};
  }
}

void main() {
  test('giftPulse: đúng path UUID + body amount/message/chapterId', () async {
    final api = _FakeApi();
    final repo = StoriesRepository(api);
    await repo.giftPulse('uuid-123', amount: 30, message: '☕ Coffee', chapterId: 'ch9');
    expect(api.lastPath, '/stories/uuid-123/gift');
    expect(api.lastBody, {'amount': 30, 'message': '☕ Coffee', 'chapterId': 'ch9'});
  });

  test('buildChapterWebUrl: canonical không kèm lang', () {
    expect(buildChapterWebUrl('tien-nghich', 12), 'https://dreamtap.me/story/tien-nghich/chuong-12');
  });
}
```

(Nếu chữ ký `ApiClient.post` thật khác named params, chỉnh override cho khớp như Task 1.)

- [ ] **Step 2: Chạy test → FAIL**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test test/data/gift_share_test.dart`
Expected: FAIL compile — `giftPulse`/`share_links.dart` chưa tồn tại.

- [ ] **Step 3: Implement từng điểm:**

3a. `pubspec.yaml` — dưới `flutter_colorpicker: ^1.1.0` thêm:

```yaml
  share_plus: ^10.1.2
```

Run: `"/d/SetupC/flutter/bin/flutter.bat" pub get` → resolve OK.

3b. `api_endpoints.dart` — nhóm Stories, sau `storyUnlock`:

```dart
  static String storyGift(String id) => '/stories/$id/gift';
```

3c. `api_env.dart` — sau `stagingBaseUrl`:

```dart
  /// Domain WEB đọc truyện (share link chương). Đổi 1 chỗ này khi web đổi domain.
  static const String webBaseUrl = 'https://dreamtap.me';
```

3d. `models.dart` — class `Book`: thêm field + param (KHÔNG required, không phá const call-sites):

```dart
  /// UUID thật của truyện từ BE (Book.id là slug). Null với dữ liệu Demo.
  final String? uuid;
```

(thêm `this.uuid,` vào constructor.)

3e. `book_mapper.dart` — trong `fromJson`, thêm vào constructor `Book(...)`:

```dart
      uuid: j['id']?.toString(),
```

3f. `stories_repository.dart` — sau `trending`/`cachedTrending`:

```dart
  /// Tặng Pulse cho truyện (nút Support cuối chương). Cần đăng nhập; BE trừ số dư thật.
  Future<void> giftPulse(String storyId, {required int amount, String? message, String? chapterId}) =>
      _api.post(ApiEndpoints.storyGift(storyId), body: {
        'amount': amount,
        'message': ?message,
        'chapterId': ?chapterId,
      });
```

3g. Tạo `lib/data/share_links.dart`:

```dart
import '../api/api_env.dart';

/// Link web đọc chương — đúng canonical của web (KHÔNG kèm segment ngôn ngữ):
/// https://dreamtap.me/story/{slug}/chuong-{N}
String buildChapterWebUrl(String storySlug, int chapterNumber) =>
    '${ApiEnv.webBaseUrl}/story/$storySlug/chuong-$chapterNumber';
```

3h. `sheets.dart` — thay TOÀN BỘ hàm `showGiftSheet` (giữ nguyên UI grid, nối API):

```dart
/// Sheet tặng quà (Support): grid vật phẩm — bấm là gửi gift Pulse THẬT qua BE
/// (`POST /stories/:id/gift`, amount = giá vật phẩm, message = emoji + tên).
/// [storyUuid] null (dữ liệu demo/chưa sync) → báo lỗi nhẹ. Cần đăng nhập.
Future<void> showGiftSheet(BuildContext context, {required String author, required String? storyUuid, String? chapterId}) {
  return _showSheet<void>(context, (c) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, Gap.xl),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Support $author', style: AppType.section(color: pal.ink)),
        Text('Send a gift to encourage the author', style: AppType.meta(size: 12, color: pal.muted)),
        const SizedBox(height: Gap.lg),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          mainAxisSpacing: Gap.md,
          crossAxisSpacing: Gap.md,
          childAspectRatio: 0.92,
          children: Demo.gifts.map((g) => InkWell(
                borderRadius: rounded(14),
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  if (context.read<AuthNotifier>().user == null) {
                    Navigator.pop(c);
                    context.push('/login');
                    return;
                  }
                  if (storyUuid == null || storyUuid.isEmpty) {
                    Navigator.pop(c);
                    messenger.showSnackBar(const SnackBar(content: Text('Chưa đồng bộ truyện — thử lại sau')));
                    return;
                  }
                  Navigator.pop(c);
                  try {
                    await context.read<StoriesRepository>().giftPulse(
                        storyUuid, amount: g.coins, message: '${g.emoji} ${g.name}', chapterId: chapterId);
                    messenger.showSnackBar(SnackBar(content: Text('Đã tặng ${g.emoji} ${g.name} cho $author!')));
                    unawaited(context.read<AuthNotifier>().refreshUser()); // đồng bộ số dư Pulse
                  } on ApiException catch (e) {
                    messenger.showSnackBar(SnackBar(content: Text(e.message)));
                  } catch (_) {
                    messenger.showSnackBar(const SnackBar(content: Text('Tặng quà thất bại — thử lại')));
                  }
                },
```

(phần render Container/emoji/tên/giá GIỮ NGUYÊN như hiện tại; imports sheets.dart cần thêm: `dart:async` (unawaited), `go_router` (context.push), `../api/api_exception.dart`, `../data/repositories/stories_repository.dart`, `../state/auth_notifier.dart` — giữ import cũ. LƯU Ý context sau await: dùng `messenger` đã lấy trước await; KHÔNG dùng `context.read` sau await ngoài `refreshUser` — lấy `auth = context.read<AuthNotifier>()` TRƯỚC await rồi gọi `unawaited(auth.refreshUser())` để tránh lint `use_build_context_synchronously`; tương tự lấy `repo` trước await.)

3i. `reader_screen.dart` end-of-chapter — thay 2 call-site:

```dart
        card(Icons.favorite_border, 'Support', () => showGiftSheet(context, author: book.author, storyUuid: book.uuid, chapterId: _chapterId)),
        const SizedBox(width: Gap.md),
        card(Icons.ios_share, 'Share', () => Share.share('${book.title} — Chương $_chapter\n${buildChapterWebUrl(book.id, _chapter)}')),
```

- import thêm ở reader: `package:share_plus/share_plus.dart` + `../../data/share_links.dart`.
- LƯU Ý: nếu version share_plus resolve về đánh dấu `Share.share` deprecated (analyzer báo info `deprecated_member_use` MỚI) → dùng API mới `SharePlus.instance.share(ShareParams(text: '...'))` thay thế — không để lại info mới.

- [ ] **Step 4: Chạy test → PASS + verify**

Run: `"/d/SetupC/flutter/bin/flutter.bat" test` → PASS toàn bộ.
Run: `"/d/SetupC/flutter/bin/flutter.bat" analyze` → 0 lỗi/0 cảnh báo.

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add pubspec.yaml pubspec.lock lib/api/api_endpoints.dart lib/api/api_env.dart lib/models/models.dart lib/data/mappers/book_mapper.dart lib/data/repositories/stories_repository.dart lib/data/share_links.dart lib/widgets/sheets.dart lib/screens/novel/reader_screen.dart test/data/gift_share_test.dart
git commit -m "feat(reader): Support tặng Pulse thật + Share link web chương

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Verify toàn bộ + docs

**Files:**
- Modify: `CHANGELOG.md` (section mới trong entry `## 2026-07-15`), `lib/screens/novel/README.md` (row reader), `lib/data/README.md` (row comments repo + share_links), `lib/widgets/README.md` (đối chiếu lại mô tả gift sheet)

**Interfaces:** không — docs + verify.

- [ ] **Step 1: Full verify**

```bash
"/d/SetupC/flutter/bin/flutter.bat" test
"/d/SetupC/flutter/bin/flutter.bat" analyze
```

Expected: PASS toàn bộ (59 cũ + 9 mới = 68); analyze 0 lỗi/0 cảnh báo.

- [ ] **Step 2: `CHANGELOG.md`** — trong entry `## 2026-07-15`, SAU section `### Novel Home — data thật` (trước `---`), thêm:

```markdown
### Reader — Bình luận + Support/Share thật
- **Bình luận theo đoạn**: đoạn có comment hiện bong bóng 💬 + số (bấm xem); **chạm giữ** đoạn để viết comment đầu tiên. Neo theo NỘI DUNG đoạn (thuật toán anchor đồng nhất với web) nên comment viết từ web hiện đúng đoạn trên app dù 2 bên tách đoạn khác nhau; fallback theo index.
- **Bình luận cấp chương**: nút Comment cuối chương mở sheet thật — phân trang, sort Mới nhất/Hữu ích, **trả lời lồng 1 cấp**, **reactions** 👍❤️⭐ (đếm từ BE sau toggle), báo cáo comment. Viết/tương tác yêu cầu đăng nhập (đẩy sang màn login); đọc offline thì ẩn bubble.
- **Support**: sheet quà giữ giao diện cũ nhưng tặng **Pulse thật** (`POST /stories/:id/gift`, kèm chương đang đọc + message tên quà); lỗi thiếu Pulse hiện từ BE; tặng xong tự đồng bộ số dư. `Book` thêm `uuid` (BE cần UUID, không nhận slug).
- **Share**: chia sẻ link web đúng chương — `https://dreamtap.me/story/{slug}/chuong-{N}` (share_plus; domain đổi 1 chỗ ở `ApiEnv.webBaseUrl`).
- Bỏ sheet comment demo (`showCommentSheet`).
```

- [ ] **Step 3: `lib/screens/novel/README.md`** — row `reader_screen.dart`: sau cụm về read-along thêm `; **comment theo đoạn** (bubble + long-press, anchor tương thích web) + sheet comment chương; Support gift Pulse thật; Share link web chương`.

- [ ] **Step 4: `lib/data/README.md`** — bảng Cấu trúc thêm 2 row (sau row categories_repository):

```markdown
| `repositories/comments_repository.dart` | `ChapterComment`/`CommentPage` + `paragraphAll`/`chapterPage`/`replies`/`create`/`toggleReaction`/`report` (module chapter-comments BE). |
| `comments/paragraph_anchor.dart` | `makeAnchor` (đồng nhất web) + `matchCommentsToParagraphs` (anchor-first, index-fallback). |
```

và row `share_links.dart`:

```markdown
| `share_links.dart` | `buildChapterWebUrl(slug, n)` — link web chương cho nút Share (`ApiEnv.webBaseUrl`). |
```

`lib/widgets/README.md`: cập nhật mô tả `showGiftSheet` thành "gửi gift Pulse thật qua BE (amount theo vật phẩm, kèm chapterId)" (dòng 16 cũ nói trừ coin demo).

- [ ] **Step 5: Commit**

```bash
cd /d/SetupC/Projects/NovelApp/novelverse
git add CHANGELOG.md lib/screens/novel/README.md lib/data/README.md lib/widgets/README.md
git commit -m "docs: Reader comments + Support/Share (CHANGELOG + README data/novel/widgets)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
