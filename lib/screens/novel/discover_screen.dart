import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/repositories/categories_repository.dart';
import '../../data/repositories/stories_repository.dart';
import '../../models/models.dart';
import '../../state/async_value.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Discover (thiết kế anh/Discover/menu.png): header DÍNH (sticky) gồm ô tìm kiếm
/// thật + nút quà/ngôn ngữ + hàng pill sắp xếp (Discover/New/Bestseller/Rising +
/// View all).
///
/// KHÁC Home: Discover hiển thị **MỌI ngôn ngữ** (không lọc theo ngôn ngữ nội dung)
/// để user tìm được bất kỳ truyện nào → có state RIÊNG (không dùng chung
/// [StoriesNotifier] vốn lọc theo lang cho Home).
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  late final StoriesRepository _repo;
  AsyncValue<List<Book>> _result = const AsyncLoading();
  final _searchCtrl = TextEditingController();
  final _searchFocus = FocusNode();
  Timer? _debounce;
  int _sortIndex = 0;
  int? _categoryId; // lọc theo thể loại (chọn từ "View all")
  List<Category> _categories = const [];

  // Pill: (nhãn, sort BE, trendWindow). Mỗi pill là một cách xếp/khung thời gian:
  //  Discover=phổ biến, New=mới phát hành, Bestseller=nhiều Pulse tặng, Rising=hot tuần.
  static const _tabs = <(String, String, String)>[
    ('Discover', 'views', ''),
    ('New', 'latest', ''),
    ('Bestseller', 'gifts', ''),
    ('Rising', 'views', 'week'),
  ];
  static const _tabLabels = ['Discover', 'New', 'Bestseller', 'Rising'];

  @override
  void initState() {
    super.initState();
    _repo = context.read<StoriesRepository>();
    _load();
    _loadCategories();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  /// Tải truyện — MỌI ngôn ngữ (lang rỗng → BE không lọc). Áp search/sort/category.
  Future<void> _load() async {
    if (mounted && _result is! AsyncData) setState(() => _result = const AsyncLoading());
    final q = _searchCtrl.text.trim();
    try {
      final tab = _tabs[_sortIndex];
      final paged = await _repo.explore(
        search: q.isEmpty ? null : q,
        categoryId: _categoryId,
        sort: tab.$2,
        trendWindow: tab.$3.isEmpty ? null : tab.$3,
        lang: '', // ← toàn bộ ngôn ngữ
        limit: 60,
      );
      if (mounted) setState(() => _result = AsyncData(paged.books));
    } catch (e) {
      if (mounted) setState(() => _result = AsyncError(e));
    }
  }

  /// Thể loại (dùng cho "View all"). Category dùng chung mọi ngôn ngữ nên lang nào cũng được.
  Future<void> _loadCategories() async {
    final repo = context.read<CategoriesRepository>();
    final cached = repo.cached(lang: 'vi');
    if (cached != null && cached.isNotEmpty && mounted) {
      setState(() => _categories = cached);
    }
    try {
      final fresh = await repo.getCategories(lang: 'vi');
      if (mounted) setState(() => _categories = fresh);
    } catch (_) {/* giữ cache/rỗng */}
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  void _selectSort(int i) {
    if (_sortIndex == i) return;
    setState(() => _sortIndex = i);
    _load();
  }

  void _clearSearch() {
    _searchCtrl.clear();
    _searchFocus.unfocus();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      backgroundColor: pal.bg,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppPalette.terracotta,
          onRefresh: () async {
            await _load();
            await _loadCategories();
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: _HeaderDelegate(
                  pal: pal,
                  controller: _searchCtrl,
                  focusNode: _searchFocus,
                  onChanged: _onSearchChanged,
                  onClear: _clearSearch,
                  onGift: () => context.push('/wallet'),
                  onGlobe: () => context.push('/language'),
                  tabs: _tabLabels,
                  sortIndex: _sortIndex,
                  onSort: _selectSort,
                  onViewAll: _showCategories,
                ),
              ),
              ..._content(context),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _content(BuildContext context) {
    final pal = context.pal;
    Widget wrap(Widget child) => SliverToBoxAdapter(
          child: Padding(padding: const EdgeInsets.only(top: 60), child: Center(child: child)),
        );
    switch (_result) {
      case AsyncLoading():
        return [wrap(const CircularProgressIndicator(color: AppPalette.terracotta))];
      case AsyncError():
        return [
          wrap(Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.cloud_off, size: 44, color: pal.muted),
            const SizedBox(height: 10),
            Text('Không tải được truyện', style: AppType.item(size: 14, color: pal.ink)),
            const SizedBox(height: Gap.md),
            TextButton(
              style: TextButton.styleFrom(backgroundColor: AppPalette.terracotta, padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11)),
              onPressed: _load,
              child: Text('Thử lại', style: AppType.btn(size: 13, color: Colors.white)),
            ),
          ])),
        ];
      case AsyncData(:final value):
        if (value.isEmpty) {
          final q = _searchCtrl.text.trim();
          return [wrap(Text(q.isEmpty ? 'Chưa có truyện' : 'Không tìm thấy “$q”', style: AppType.body(size: 14, color: pal.muted)))];
        }
        // Tab "New": item đầu + cứ mỗi 4 item hiện dạng ẢNH nổi bật (ẩn thông tin),
        // xen giữa là list thường.
        final feature = _sortIndex == 1;
        return [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.sm, Gap.screenH, Gap.xxl),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => (feature && i % 4 == 0)
                    ? _featureImage(context, value[i])
                    : _resultRow(context, value[i]),
                childCount: value.length,
              ),
            ),
          ),
        ];
    }
  }

  /// Kết quả dạng chỉ-ẢNH (tab New): bìa lớn full-width, ẩn mọi thông tin khác.
  Widget _featureImage(BuildContext context, Book b) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: GestureDetector(
        onTap: () => context.push('/book/${b.id}'),
        child: CoverImage(path: b.cover, title: b.title, radius: 16, aspect: 16 / 9),
      ),
    );
  }

  /// Dòng kết quả (thiết kế anh/New folder/search.png): bìa + tên + thể loại +
  /// tóm tắt 2 dòng + lượt xem · sao.
  Widget _resultRow(BuildContext context, Book b) {
    final pal = context.pal;
    return InkWell(
      onTap: () => context.push('/book/${b.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 78, child: CoverImage(path: b.cover, title: b.title, radius: 12)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(b.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppType.hero(size: 17, color: pal.ink)),
              const SizedBox(height: 4),
              if (b.categoriesLabel.isNotEmpty)
                Text(b.categoriesLabel, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 12.5, color: pal.muted)),
              if (b.synopsis.trim().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(b.synopsis.trim(), maxLines: 2, overflow: TextOverflow.ellipsis, style: AppType.body(size: 13.5, color: pal.soft).copyWith(height: 1.35)),
              ],
              const SizedBox(height: 8),
              Row(children: [
                Icon(Icons.visibility_outlined, size: 15, color: AppPalette.terracotta),
                const SizedBox(width: 4),
                Text(b.reads, style: AppType.item(size: 12.5, color: AppPalette.terracotta)),
                Text('  ·  ', style: AppType.meta(size: 12.5, color: pal.muted)),
                const Text('⭐', style: TextStyle(fontSize: 13)),
                const SizedBox(width: 3),
                Text(b.rating, style: AppType.item(size: 12.5, color: AppPalette.terracotta)),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }

  /// "View all" → sheet chọn thể loại THẬT (BE) để lọc; "Tất cả" bỏ lọc.
  void _showCategories() {
    final pal = context.pal;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: pal.bg2,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Thể loại', style: AppType.hero(size: 20, color: pal.ink)),
          const SizedBox(height: Gap.md),
          Wrap(spacing: 10, runSpacing: 10, children: [
            _catChip(context, 'Tất cả', _categoryId == null, () => _pickCategory(null)),
            for (final c in _categories) _catChip(context, c.name, _categoryId == c.id, () => _pickCategory(c.id)),
          ]),
        ]),
      ),
    );
  }

  void _pickCategory(int? id) {
    setState(() => _categoryId = id);
    Navigator.of(context).pop();
    _load();
  }

  Widget _catChip(BuildContext context, String label, bool sel, VoidCallback onTap) {
    final pal = context.pal;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: sel ? AppPalette.terracotta : pal.surf2,
          borderRadius: rounded(20),
          border: Border.all(color: sel ? AppPalette.terracotta : pal.line),
        ),
        child: Text(label, style: AppType.btn(size: 13, color: sel ? Colors.white : pal.amber)),
      ),
    );
  }
}

/// Header dính (search + quà/ngôn ngữ + pill sắp xếp). Cao cố định.
class _HeaderDelegate extends SliverPersistentHeaderDelegate {
  _HeaderDelegate({
    required this.pal,
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onClear,
    required this.onGift,
    required this.onGlobe,
    required this.tabs,
    required this.sortIndex,
    required this.onSort,
    required this.onViewAll,
  });

  final AppPalette pal;
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear, onGift, onGlobe, onViewAll;
  final List<String> tabs;
  final int sortIndex;
  final ValueChanged<int> onSort;

  static const double _height = 116;

  @override
  double get minExtent => _height;
  @override
  double get maxExtent => _height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: pal.bg,
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.sm, Gap.screenH, Gap.sm),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Hàng 1: ô tìm kiếm + quà + ngôn ngữ
          Row(children: [
            Expanded(
              child: Container(
                height: 46,
                padding: const EdgeInsets.symmetric(horizontal: Gap.md),
                decoration: BoxDecoration(color: pal.card, borderRadius: rounded(24), border: Border.all(color: pal.line)),
                child: Row(children: [
                  Icon(Icons.search, color: pal.muted, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      focusNode: focusNode,
                      onChanged: onChanged,
                      textInputAction: TextInputAction.search,
                      style: AppType.body(size: 14, color: pal.ink),
                      cursorColor: AppPalette.terracotta,
                      decoration: InputDecoration(
                        isCollapsed: true,
                        border: InputBorder.none,
                        hintText: 'Title, author, tag…',
                        hintStyle: AppType.body(size: 14, color: pal.muted),
                      ),
                    ),
                  ),
                  // Nút xoá khi có chữ.
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: controller,
                    builder: (_, v, __) => v.text.isEmpty
                        ? const SizedBox.shrink()
                        : GestureDetector(
                            onTap: onClear,
                            child: Icon(Icons.close, size: 18, color: pal.muted),
                          ),
                  ),
                ]),
              ),
            ),
            const SizedBox(width: Gap.sm),
            _circleBtn(Icons.card_giftcard_outlined, onGift),
            const SizedBox(width: Gap.sm),
            _circleBtn(Icons.language, onGlobe),
          ]),
          const SizedBox(height: 10),
          // Hàng 2: pill sắp xếp + View all
          SizedBox(
            height: 36,
            child: Row(children: [
              Expanded(
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: tabs.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 18),
                  itemBuilder: (_, i) => _tab(tabs[i], i == sortIndex, () => onSort(i)),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onViewAll,
                child: Text('View all', style: AppType.btn(size: 13, color: AppPalette.terracotta)),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _circleBtn(IconData icon, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(color: pal.card, shape: BoxShape.circle, border: Border.all(color: pal.line)),
          alignment: Alignment.center,
          child: Icon(icon, size: 20, color: AppPalette.terracotta),
        ),
      );

  // Tab dạng CHỮ: chọn = terracotta + đậm; còn lại = muted nhạt. Gọn để hiện nhiều menu.
  Widget _tab(String label, bool selected, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Center(
          child: Text(
            label,
            style: AppType.btn(size: selected ? 15.5 : 14.5, color: selected ? AppPalette.terracotta : pal.muted)
                .copyWith(fontWeight: selected ? FontWeight.w800 : FontWeight.w600),
          ),
        ),
      );

  @override
  bool shouldRebuild(covariant _HeaderDelegate old) =>
      old.sortIndex != sortIndex || old.pal != pal || old.tabs != tabs;
}
