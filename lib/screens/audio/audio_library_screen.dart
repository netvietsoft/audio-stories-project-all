import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../state/async_value.dart';
import '../../state/music_notifier.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

class AudioLibraryScreen extends StatefulWidget {
  const AudioLibraryScreen({super.key});

  @override
  State<AudioLibraryScreen> createState() => _AudioLibraryScreenState();
}

class _AudioLibraryScreenState extends State<AudioLibraryScreen> {
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
    final songsState = context.watch<MusicNotifier>().songs;
    return Scaffold(
      backgroundColor: pal.bg,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.lg, Gap.screenH, Gap.xxl),
          children: [
            Text('Library', style: AppType.hero(size: 26, color: pal.ink)),
            const SizedBox(height: Gap.md),
            // Audiobook continue
            GestureDetector(
              onTap: () => context.push('/audiobook'),
              child: Container(
                padding: const EdgeInsets.all(Gap.md),
                decoration: BoxDecoration(color: pal.plumSurf, borderRadius: rounded(Radii.card), border: Border.all(color: pal.line)),
                child: Row(children: [
                  SizedBox(width: 48, child: CoverImage(path: 'assets/covers/top_5.png', title: 'The Lycan King', aspect: 1, radius: 8)),
                  const SizedBox(width: Gap.md),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Audiobook · Ep 4', style: AppType.meta(color: pal.muted)),
                    Text('The Lycan King', style: AppType.item(size: 14, color: pal.ink)),
                  ])),
                  const Icon(Icons.play_circle_fill, color: AppPalette.plum, size: 30),
                ]),
              ),
            ),
            const SizedBox(height: Gap.xl),
            Row(children: [
              Expanded(child: Text('Songs', style: AppType.section(color: pal.ink))),
              TextButton(
                onPressed: () => context.push('/favourites'),
                child: Text('Favourites ♥', style: AppType.btn(size: 13, color: AppPalette.plum)),
              ),
            ]),
            const SizedBox(height: Gap.sm),
            ..._songList(context, songsState),
          ],
        ),
      ),
    );
  }

  List<Widget> _songList(BuildContext context, AsyncValue<List<Song>> state) {
    final pal = context.pal;
    return switch (state) {
      AsyncLoading() => [
          for (var i = 0; i < 6; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(children: [
                Container(width: 44, height: 44, decoration: BoxDecoration(color: pal.surf, borderRadius: rounded(8))),
                const SizedBox(width: Gap.md),
                Expanded(child: Container(height: 12, decoration: BoxDecoration(color: pal.surf, borderRadius: rounded(6)))),
              ]),
            ),
        ],
      AsyncError() => [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Column(children: [
              Icon(Icons.cloud_off, size: 40, color: pal.muted),
              const SizedBox(height: 8),
              Text('Không tải được nhạc', style: AppType.body(size: 14, color: pal.muted)),
              const SizedBox(height: Gap.sm),
              TextButton(
                onPressed: () => context.read<MusicNotifier>().load(),
                child: Text('Thử lại', style: AppType.btn(size: 13, color: AppPalette.plum)),
              ),
            ]),
          ),
        ],
      AsyncData(:final value) => [
          for (final s in value)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: SizedBox(width: 44, child: CoverImage(path: s.cover, title: s.title, aspect: 1, radius: 8)),
              title: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 13.5, color: pal.ink)),
              subtitle: Text(s.author, style: AppType.meta(size: 11, color: pal.muted)),
              trailing: IconButton(
                icon: Icon(context.watch<AppState>().isLiked(s.title) ? Icons.favorite : Icons.favorite_border,
                    color: context.watch<AppState>().isLiked(s.title) ? AppPalette.plum : pal.muted, size: 20),
                onPressed: () => context.read<AppState>().toggleLike(s.title),
              ),
              onTap: () {
                context.read<AppState>().playSong(s, queue: value);
                context.push('/player');
              },
            ),
        ],
    };
  }
}
