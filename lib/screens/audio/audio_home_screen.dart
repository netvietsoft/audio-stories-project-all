import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/demo_data.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../state/async_value.dart';
import '../../state/music_notifier.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';
import '../novel/novel_home_screen.dart' show TopBarShared;

class AudioHomeScreen extends StatefulWidget {
  const AudioHomeScreen({super.key});

  static const _chips = ['Short Stories', 'Podcast', 'Relax', 'Pop', 'K-Pop', 'Lofi', 'Romance', 'Sleep'];

  @override
  State<AudioHomeScreen> createState() => _AudioHomeScreenState();
}

class _AudioHomeScreenState extends State<AudioHomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MusicNotifier>().ensureLoaded();
    });
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final notifier = context.watch<MusicNotifier>();
    return Scaffold(
      backgroundColor: pal.bg,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const TopBarShared(),
            ..._content(context, notifier),
            const SizedBox(height: Gap.xxl),
          ],
        ),
      ),
    );
  }

  Widget _chips(BuildContext context) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Gap.screenH, vertical: Gap.md),
      child: Wrap(spacing: 8, runSpacing: 8, children: [
        for (final c in AudioHomeScreen._chips)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(color: pal.plumSurf, borderRadius: rounded(18), border: Border.all(color: pal.line)),
            child: Text(c, style: AppType.btn(size: 12.5, color: AppPalette.plum)),
          ),
      ]),
    );
  }

  List<Widget> _content(BuildContext context, MusicNotifier n) {
    // Charts dùng Demo (endpoint charts chưa wire). Phần bài hát theo trạng thái async.
    return switch (n.songs) {
      AsyncLoading() => [_chips(context), _sectionHeader(context, 'Made for You'), _railSkeleton(context)],
      AsyncError(:final error) => [_errorView(context, error)],
      AsyncData(:final value) => [
          _sectionHeader(context, 'Continue Listening'),
          if (value.isNotEmpty) _songRow(context, value.first, value),
          _chips(context),
          _sectionHeader(context, 'Made for You'),
          _songCardRail(context, value),
          _sectionHeader(context, 'Charts'),
          _chartRail(context),
          _sectionHeader(context, 'New Releases'),
          _songCardRail(context, value.reversed.toList()),
        ],
    };
  }

  Widget _railSkeleton(BuildContext context) => SizedBox(
        height: 168,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenH),
          itemCount: 4,
          separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
          itemBuilder: (_, __) => SizedBox(
            width: 124,
            child: AspectRatio(
              aspectRatio: 1,
              child: Container(decoration: BoxDecoration(color: context.pal.surf, borderRadius: rounded(10))),
            ),
          ),
        ),
      );

  Widget _errorView(BuildContext context, Object error) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(children: [
        Icon(Icons.cloud_off, size: 44, color: pal.muted),
        const SizedBox(height: 10),
        Text('Không tải được nhạc', style: AppType.item(size: 14, color: pal.ink)),
        const SizedBox(height: 4),
        Text('$error', textAlign: TextAlign.center, style: AppType.meta(size: 11, color: pal.muted)),
        const SizedBox(height: Gap.md),
        TextButton(
          style: TextButton.styleFrom(backgroundColor: AppPalette.plum, padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11)),
          onPressed: () => context.read<MusicNotifier>().load(),
          child: Text('Thử lại', style: AppType.btn(size: 13, color: Colors.white)),
        ),
      ]),
    );
  }

  Widget _sectionHeader(BuildContext context, String t) => Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.xl, Gap.screenH, Gap.sm),
        child: Text(t, style: AppType.section(color: context.pal.ink)),
      );

  Widget _songRow(BuildContext context, Song s, List<Song> queue) {
    final pal = context.pal;
    return GestureDetector(
      onTap: () => _play(context, s, queue),
      child: Container(
        margin: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, 0),
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(color: pal.card, borderRadius: rounded(Radii.card), border: Border.all(color: pal.line)),
        child: Row(children: [
          SizedBox(width: 48, child: CoverImage(path: s.cover, title: s.title, aspect: 1, radius: 8)),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 14, color: pal.ink)),
              Text(s.author, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(color: pal.muted)),
            ]),
          ),
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(color: AppPalette.plum, shape: BoxShape.circle),
            child: const Icon(Icons.play_arrow, color: Colors.white, size: 22),
          ),
        ]),
      ),
    );
  }

  Widget _songCardRail(BuildContext context, List<Song> songs) {
    final pal = context.pal;
    return SizedBox(
      height: 168,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenH),
        itemCount: songs.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
        itemBuilder: (_, i) {
          final s = songs[i];
          return GestureDetector(
            onTap: () => _play(context, s, songs),
            child: SizedBox(
              width: 124,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                CoverImage(path: s.cover, title: s.title, aspect: 1, radius: 10),
                const SizedBox(height: 6),
                Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 12.5, color: pal.soft)),
                Text(s.author, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 10.5, color: pal.muted)),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _chartRail(BuildContext context) {
    return SizedBox(
      height: 150,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenH),
        itemCount: Demo.charts.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
        itemBuilder: (_, i) {
          final c = Demo.charts[i];
          return SizedBox(
            width: 120,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CoverImage(path: c.cover, title: c.title, aspect: 1, radius: 10),
              const SizedBox(height: 6),
              Text(c.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppType.item(size: 12, color: context.pal.soft)),
            ]),
          );
        },
      ),
    );
  }

  // Phát kèm QUEUE (danh sách đang hiển thị) → next/prev hoạt động + preload bài kế.
  void _play(BuildContext context, Song s, List<Song> queue) {
    context.read<AppState>().playSong(s, queue: queue);
    context.push('/player');
  }
}
