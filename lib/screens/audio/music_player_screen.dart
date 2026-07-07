import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/demo_data.dart';
import '../../state/app_state.dart';
import '../../utils/format.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Music Player: cover lớn, tên/nghệ sĩ, ♥ (lưu yêu thích thật), progress chạy
/// + tua thật, điều khiển play/prev/next thật, gợi ý bài hát.
class MusicPlayerScreen extends StatelessWidget {
  const MusicPlayerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final app = context.watch<AppState>();
    final title = app.nowPlayingTitle ?? Demo.songs.first.title;
    final author = app.nowPlayingAuthor ?? Demo.songs.first.author;
    final cover = app.nowPlayingCover ?? Demo.songs.first.cover;

    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.keyboard_arrow_down, color: pal.ink, size: 30), onPressed: () => context.pop()),
        title: Text('Now Playing', style: AppType.item(size: 13, color: pal.muted)),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.xl, 0, Gap.xl, Gap.xxl),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: CoverImage(path: cover, title: title, aspect: 1, radius: 18),
          ),
          const SizedBox(height: Gap.xl),
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.hero(size: 22, color: pal.ink)),
                Text(author, style: AppType.body(size: 14, color: pal.muted)),
              ]),
            ),
            IconButton(
              icon: Icon(app.isLiked(title) ? Icons.favorite : Icons.favorite_border,
                  color: app.isLiked(title) ? AppPalette.plum : pal.muted, size: 28),
              onPressed: () => app.toggleLike(title),
            ),
          ]),
          const SizedBox(height: Gap.lg),
          // Chỉ phần này rebuild theo vị trí phát (ValueListenable), không phải cả màn.
          ValueListenableBuilder<Duration>(
            valueListenable: app.position,
            builder: (_, pos, __) {
              final durMs = app.duration.value.inMilliseconds;
              final value = durMs > 0 ? (pos.inMilliseconds / durMs).clamp(0.0, 1.0) : 0.0;
              // Thanh buffer: phần đã đệm (secondaryTrackValue) — luôn >= vị trí phát.
              final buf = durMs > 0 ? (app.buffered.value.inMilliseconds / durMs).clamp(0.0, 1.0) : 0.0;
              return Column(children: [
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(trackHeight: 4, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7)),
                  child: Slider(
                    value: value.toDouble(),
                    secondaryTrackValue: buf.toDouble(),
                    activeColor: AppPalette.plum,
                    inactiveColor: pal.line,
                    secondaryActiveColor: AppPalette.plum.withValues(alpha: 0.3),
                    onChanged: durMs > 0 ? (v) => app.seek(Duration(milliseconds: (v * durMs).round())) : null,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text(formatClock(pos), style: AppType.meta(size: 11, color: pal.muted)),
                    Text(formatClock(app.duration.value), style: AppType.meta(size: 11, color: pal.muted)),
                  ]),
                ),
              ]);
            },
          ),
          const SizedBox(height: Gap.md),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            IconButton(icon: Icon(Icons.skip_previous, color: pal.ink, size: 36), onPressed: app.prev),
            const SizedBox(width: Gap.xl),
            GestureDetector(
              onTap: app.togglePlay,
              child: Container(
                width: 68,
                height: 68,
                decoration: const BoxDecoration(color: AppPalette.plum, shape: BoxShape.circle),
                child: Icon(app.playing ? Icons.pause : Icons.play_arrow, color: Colors.white, size: 36),
              ),
            ),
            const SizedBox(width: Gap.xl),
            IconButton(icon: Icon(Icons.skip_next, color: pal.ink, size: 36), onPressed: app.next),
          ]),
          const SizedBox(height: Gap.xl),
          Text('Up Next', style: AppType.section(color: pal.ink)),
          const SizedBox(height: Gap.sm),
          ...Demo.songs.map((s) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: SizedBox(width: 44, child: CoverImage(path: s.cover, title: s.title, aspect: 1, radius: 8)),
                title: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 13.5, color: pal.ink)),
                subtitle: Text(s.author, style: AppType.meta(size: 11, color: pal.muted)),
                trailing: Icon(Icons.play_arrow, color: pal.muted),
                onTap: () => context.read<AppState>().playSong(s),
              )),
        ],
      ),
    );
  }

}
