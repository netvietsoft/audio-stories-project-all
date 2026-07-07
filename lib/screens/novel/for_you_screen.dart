import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/async_value.dart';
import '../../state/stories_notifier.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Trang "For You" (mở từ nút View All ở Home) — danh sách chi tiết theo thiết kế
/// anh/Foru: bìa (badge ⭐ điểm) + tên + tóm tắt + thể loại · lượt xem.
/// Dùng chung dữ liệu [StoriesNotifier] (đã lọc theo ngôn ngữ nội dung như Home).
class ForYouScreen extends StatelessWidget {
  const ForYouScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final notifier = context.watch<StoriesNotifier>();
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.arrow_back, color: pal.ink), onPressed: () => context.pop()),
        title: Text('For You', style: AppType.hero(size: 20, color: pal.ink)),
      ),
      body: switch (notifier.explore) {
        AsyncLoading() => const Center(child: CircularProgressIndicator(color: AppPalette.terracotta)),
        AsyncError() => Center(child: Text('Không tải được truyện', style: AppType.body(size: 14, color: pal.muted))),
        AsyncData(:final value) when value.isEmpty => Center(child: Text('Chưa có truyện', style: AppType.body(size: 14, color: pal.muted))),
        AsyncData(:final value) => _list(context, value),
      },
    );
  }

  Widget _list(BuildContext context, List<Book> books) {
    final top = books.take(4).toList(); // hàng 4 bìa trên đầu
    final rest = books.length > 4 ? books.sublist(4) : const <Book>[];
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _topGrid(context, top)),
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (_, i) => _row(context, rest[i]),
            childCount: rest.length,
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: Gap.xxl)),
      ],
    );
  }

  /// Hàng 4 bìa trên đầu (bìa + tên + thể loại) — thiết kế anh/Foru.
  Widget _topGrid(BuildContext context, List<Book> books) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.sm, Gap.screenH, Gap.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < books.length; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(child: _gridCard(context, books[i])),
          ],
          // Chèn ô trống nếu < 4 để giữ tỉ lệ cột.
          for (var i = books.length; i < 4; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            const Expanded(child: SizedBox.shrink()),
          ],
        ],
      ),
    );
  }

  Widget _gridCard(BuildContext context, Book b) {
    final pal = context.pal;
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CoverImage(path: b.cover, title: b.title, radius: 10),
        const SizedBox(height: 6),
        Text(b.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppType.item(size: 12, color: pal.ink)),
        const SizedBox(height: 2),
        Text(b.genre, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 11, color: pal.amber)),
      ]),
    );
  }

  Widget _row(BuildContext context, Book b) {
    final pal = context.pal;
    return InkWell(
      onTap: () => context.push('/book/${b.id}'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 10, Gap.screenH, 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            width: 96,
            child: Stack(children: [
              CoverImage(path: b.cover, title: b.title, radius: 12),
              Positioned(
                left: 6,
                bottom: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), borderRadius: rounded(7)),
                  child: Text('⭐ ${b.rating}', style: AppType.tabLabel(color: Colors.white).copyWith(fontSize: 10)),
                ),
              ),
            ]),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(b.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppType.hero(size: 16.5, color: pal.ink)),
              if (b.synopsis.trim().isNotEmpty) ...[
                const SizedBox(height: 5),
                Text(b.synopsis.trim(), maxLines: 3, overflow: TextOverflow.ellipsis, style: AppType.body(size: 13.5, color: pal.soft).copyWith(height: 1.35)),
              ],
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: Text(
                    b.categoriesLabel.isEmpty ? b.genre : b.categoriesLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.btn(size: 12, color: pal.amber),
                  ),
                ),
                const SizedBox(width: 8),
                Text('${b.reads} Views', style: AppType.meta(size: 11.5, color: pal.muted)),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}
