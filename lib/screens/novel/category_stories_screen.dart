import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/repositories/stories_repository.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Danh sách truyện theo THỂ LOẠI (đích nút "More" trên kệ Novel Home).
/// List dọc + infinite scroll qua explore(categoryId, page).
class CategoryStoriesScreen extends StatefulWidget {
  const CategoryStoriesScreen({super.key, required this.categoryId, required this.name});
  final int categoryId;
  final String name;

  @override
  State<CategoryStoriesScreen> createState() => _CategoryStoriesScreenState();
}

class _CategoryStoriesScreenState extends State<CategoryStoriesScreen> {
  final _scroll = ScrollController();
  final List<Book> _books = [];
  int _page = 1;
  bool _hasMore = true, _loading = false, _error = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients || _loading || !_hasMore) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 400) _load();
  }

  Future<void> _load() async {
    if (_loading || !_hasMore) return;
    setState(() { _loading = true; _error = false; });
    try {
      final lang = context.read<AppState>().contentLang;
      final paged = await context
          .read<StoriesRepository>()
          .explore(categoryId: widget.categoryId, page: _page, limit: 20, lang: lang);
      if (!mounted) return;
      setState(() {
        _books.addAll(paged.books);
        _hasMore = paged.hasMore;
        _page += 1;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = true; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        iconTheme: IconThemeData(color: pal.ink),
        title: Text(widget.name, style: AppType.section(color: pal.ink)),
      ),
      body: _books.isEmpty && _loading
          ? const Center(child: CircularProgressIndicator(color: AppPalette.terracotta))
          : _books.isEmpty && _error
              ? _errorView()
              : _books.isEmpty
                  ? Center(child: Text('Chưa có truyện', style: AppType.body(size: 14, color: pal.muted)))
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.symmetric(vertical: Gap.md),
                      itemCount: _books.length + (_hasMore ? 1 : 0),
                      itemBuilder: (_, i) {
                        if (i >= _books.length) {
                          if (_error) return _retryRow();
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 18),
                            child: Center(child: CircularProgressIndicator(color: AppPalette.terracotta)),
                          );
                        }
                        return _row(_books[i]);
                      },
                    ),
    );
  }

  Widget _row(Book b) {
    final pal = context.pal;
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 8, Gap.screenH, 8),
        child: Row(children: [
          SizedBox(width: 48, child: CoverImage(path: b.cover, title: b.title, radius: 8)),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 15, color: pal.ink)),
              const SizedBox(height: 4),
              Text('⭐ ${b.rating} · ${b.reads} reads',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 12.5, color: pal.muted)),
            ]),
          ),
        ]),
      ),
    );
  }

  /// Hàng retry ở cuối list khi trang ≥2 fetch lỗi (thay spinner kẹt).
  Widget _retryRow() {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('Không tải được trang tiếp', style: AppType.item(size: 14, color: pal.ink)),
        const SizedBox(height: Gap.md),
        TextButton(
          style: TextButton.styleFrom(
              backgroundColor: AppPalette.terracotta,
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11)),
          onPressed: _load,
          child: Text('Thử lại', style: AppType.btn(size: 13, color: Colors.white)),
        ),
      ]),
    );
  }

  Widget _errorView() {
    final pal = context.pal;
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.cloud_off, size: 44, color: pal.muted),
        const SizedBox(height: 10),
        Text('Không tải được truyện', style: AppType.item(size: 14, color: pal.ink)),
        const SizedBox(height: Gap.md),
        TextButton(
          style: TextButton.styleFrom(
              backgroundColor: AppPalette.terracotta,
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11)),
          onPressed: _load,
          child: Text('Thử lại', style: AppType.btn(size: 13, color: Colors.white)),
        ),
      ]),
    );
  }
}
