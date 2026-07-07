import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/demo_data.dart';
import '../../state/app_state.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Favourites: Liked Songs (bài đã ♥) + Albums yêu thích (3 cột → Album detail).
class FavouritesScreen extends StatelessWidget {
  const FavouritesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final app = context.watch<AppState>();
    final liked = app.likedSongs;

    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.arrow_back, color: pal.ink), onPressed: () => context.pop()),
        title: Text('Favourites', style: AppType.section(color: pal.ink)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
        children: [
          Row(children: [
            Container(
              width: 54, height: 54,
              decoration: BoxDecoration(borderRadius: rounded(12), gradient: const LinearGradient(colors: [AppPalette.plum, AppPalette.terracotta])),
              child: const Icon(Icons.favorite, color: Colors.white, size: 26),
            ),
            const SizedBox(width: Gap.md),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Liked Songs', style: AppType.hero(size: 20, color: pal.ink)),
              Text('${liked.length} songs', style: AppType.meta(color: pal.muted)),
            ])),
            if (liked.isNotEmpty)
              GestureDetector(
                onTap: () {
                  context.read<AppState>().playSong(liked.first, queue: liked);
                  context.push('/player');
                },
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(color: AppPalette.plum, shape: BoxShape.circle),
                  child: const Icon(Icons.play_arrow, color: Colors.white),
                ),
              ),
          ]),
          const SizedBox(height: Gap.lg),
          if (liked.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(children: [
                Icon(Icons.favorite_border, size: 44, color: pal.muted),
                const SizedBox(height: 10),
                Text('No liked songs yet', style: AppType.body(size: 14, color: pal.muted)),
                Text('Tap ♥ on any song to save it here', style: AppType.meta(size: 12, color: pal.muted)),
              ]),
            )
          else
            ...liked.map((s) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: SizedBox(width: 44, child: CoverImage(path: s.cover, title: s.title, aspect: 1, radius: 8)),
                  title: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 13.5, color: pal.ink)),
                  subtitle: Text(s.author, style: AppType.meta(size: 11, color: pal.muted)),
                  trailing: IconButton(
                    icon: const Icon(Icons.favorite, color: AppPalette.plum, size: 20),
                    onPressed: () => context.read<AppState>().toggleLike(s.title),
                  ),
                  onTap: () {
                    context.read<AppState>().playSong(s, queue: liked);
                    context.push('/player');
                  },
                )),
          const SizedBox(height: Gap.xl),
          Text('Favourite Albums', style: AppType.section(color: pal.ink)),
          const SizedBox(height: Gap.sm),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            mainAxisSpacing: Gap.md,
            crossAxisSpacing: Gap.md,
            childAspectRatio: 0.78,
            children: Demo.charts.asMap().entries.map((e) => GestureDetector(
                  onTap: () => context.push('/album/${e.key}'),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    CoverImage(path: e.value.cover, title: e.value.title, aspect: 1, radius: 10),
                    const SizedBox(height: 4),
                    Text(e.value.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 11, color: pal.soft)),
                  ]),
                )).toList(),
          ),
        ],
      ),
    );
  }
}
