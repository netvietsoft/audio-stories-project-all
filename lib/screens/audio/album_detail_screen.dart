import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/demo_data.dart';
import '../../state/app_state.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Album / Chart detail: header bìa lớn + Play all, danh sách track (bấm phát
/// thật). Dùng cho chart (Demo.charts[index]) — track list lấy từ Demo.songs.
class AlbumDetailScreen extends StatelessWidget {
  const AlbumDetailScreen({super.key, required this.index});
  final int index;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final chart = (index >= 0 && index < Demo.charts.length) ? Demo.charts[index] : Demo.charts.first;
    final tracks = Demo.songs; // demo: dùng chung danh sách bài

    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.arrow_back, color: pal.ink), onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
        children: [
          Center(
            child: SizedBox(
              width: 180,
              child: CoverImage(path: chart.cover, title: chart.title, aspect: 1, radius: 16),
            ),
          ),
          const SizedBox(height: Gap.lg),
          Text(chart.title, textAlign: TextAlign.center, style: AppType.hero(size: 22, color: pal.ink)),
          Text('${tracks.length} songs · NovelVerse', textAlign: TextAlign.center, style: AppType.meta(color: pal.muted)),
          const SizedBox(height: Gap.lg),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            GestureDetector(
              onTap: () {
                context.read<AppState>().playSong(tracks.first, queue: tracks);
                context.push('/player');
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                decoration: BoxDecoration(color: AppPalette.plum, borderRadius: rounded(Radii.button)),
                child: Text('▶  Play all', style: AppType.btn(color: Colors.white)),
              ),
            ),
          ]),
          const SizedBox(height: Gap.lg),
          ...tracks.asMap().entries.map((e) {
            final i = e.key + 1;
            final s = e.value;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: SizedBox(width: 28, child: Text('$i', style: AppType.item(size: 13, color: pal.muted))),
              title: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 14, color: pal.ink)),
              subtitle: Text(s.author, style: AppType.meta(size: 11, color: pal.muted)),
              trailing: Icon(Icons.play_circle_outline, color: pal.soft),
              onTap: () {
                context.read<AppState>().playSong(s, queue: tracks);
                context.push('/player');
              },
            );
          }),
        ],
      ),
    );
  }
}
