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

class TrendingScreen extends StatefulWidget {
  const TrendingScreen({super.key});

  @override
  State<TrendingScreen> createState() => _TrendingScreenState();
}

class _TrendingScreenState extends State<TrendingScreen> {
  int _period = 1;
  static const _periods = ['Today', 'This Week', 'This Month', 'All-time'];

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final notifier = context.watch<StoriesNotifier>();
    return Scaffold(
      backgroundColor: pal.bg,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppPalette.terracotta,
          onRefresh: () => context.read<StoriesNotifier>().loadExplore(forceRefresh: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.lg, Gap.screenH, Gap.xxl),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Text('Trending', style: AppType.hero(size: 26, color: pal.ink)),
              const SizedBox(height: Gap.md),
              SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _periods.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => GestureDetector(
                    onTap: () => setState(() => _period = i),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: i == _period ? AppPalette.terracotta : pal.surf2,
                        borderRadius: rounded(18),
                        border: Border.all(color: pal.line),
                      ),
                      child: Text(_periods[i], style: AppType.btn(size: 12.5, color: i == _period ? Colors.white : pal.amber)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: Gap.md),
              ..._rows(context, notifier),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _rows(BuildContext context, StoriesNotifier n) {
    final pal = context.pal;
    switch (n.explore) {
      case AsyncLoading():
        return [const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: AppPalette.terracotta)))];
      case AsyncError():
        return [Padding(padding: const EdgeInsets.only(top: 40), child: Center(child: Text('Không tải được truyện', style: AppType.body(size: 14, color: pal.muted))))];
      case AsyncData(:final value):
        if (value.isEmpty) {
          return [Padding(padding: const EdgeInsets.only(top: 40), child: Center(child: Text('Chưa có truyện', style: AppType.body(size: 14, color: pal.muted))))];
        }
        // Đảo thứ tự theo khoảng thời gian (cosmetic) trên dữ liệu THẬT.
        final books = _period.isEven ? value : value.reversed.toList();
        return books.asMap().entries.map((e) => _rankRow(context, e.key + 1, e.value)).toList();
    }
  }

  Widget _rankRow(BuildContext context, int rank, Book b) {
    final pal = context.pal;
    final rc = rank == 1 ? AppPalette.rank1 : rank == 2 ? AppPalette.rank2 : rank == 3 ? AppPalette.rank3 : pal.muted;
    return GestureDetector(
      onTap: () => context.push('/book/${b.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(children: [
          SizedBox(width: 30, child: Text('$rank', style: AppType.hero(size: 22, color: rc))),
          SizedBox(width: 48, child: CoverImage(path: b.cover, title: b.title, radius: 8)),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 14, color: pal.ink)),
              const SizedBox(height: 2),
              Text('${b.reads} reads · ⭐ ${b.rating}', style: AppType.meta(size: 11, color: pal.muted)),
            ]),
          ),
        ]),
      ),
    );
  }
}
