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
  int _epoch = 0; // đổi sort → tăng; response cũ về sau bị bỏ
  bool _hasMore = true, _loading = false, _sending = false, _error = false;

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
    widget.scrollController.removeListener(_onScroll);
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
    final myEpoch = _epoch;
    setState(() { _loading = true; _error = false; });
    try {
      final p = await _repo.chapterPage(widget.chapterId, page: _page + 1, sort: _sort);
      if (!mounted || myEpoch != _epoch) return;
      setState(() {
        _items.addAll(p.items);
        _page = p.page;
        _hasMore = p.hasMore;
        _loading = false;
      });
    } catch (_) {
      // Giữ nguyên _hasMore (KHÔNG ép false) → hàng cuối list đổi thành retry thay vì mất luôn "tải thêm".
      if (mounted && myEpoch == _epoch) setState(() { _loading = false; _error = true; });
    }
  }

  void _changeSort(String s) {
    if (_sort == s) return;
    setState(() { _sort = s; _items = []; _page = 0; _hasMore = true; _loading = false; _epoch++; });
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
    ctrl.dispose();
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
                          if (_error) {
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              child: Center(
                                child: Column(mainAxisSize: MainAxisSize.min, children: [
                                  Text('Không tải được', style: AppType.body(size: 13, color: pal.muted)),
                                  TextButton(
                                    onPressed: _loadMore,
                                    child: Text('Thử lại', style: AppType.btn(size: 13, color: AppPalette.terracotta)),
                                  ),
                                ]),
                              ),
                            );
                          }
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

  Widget _inputBar(AppPalette pal) {
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
