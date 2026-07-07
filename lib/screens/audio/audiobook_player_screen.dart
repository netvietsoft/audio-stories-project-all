import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../../utils/format.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

class AudiobookPlayerScreen extends StatefulWidget {
  const AudiobookPlayerScreen({super.key});

  @override
  State<AudiobookPlayerScreen> createState() => _AudiobookPlayerScreenState();
}

class _AudiobookPlayerScreenState extends State<AudiobookPlayerScreen> {
  bool _allEps = false;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final app = context.watch<AppState>();
    final eps = _allEps ? 20 : 5;
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.keyboard_arrow_down, color: pal.ink, size: 30), onPressed: () => context.pop()),
        title: Text('Audiobook', style: AppType.item(size: 13, color: pal.muted)),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.xl, 0, Gap.xl, Gap.xxl),
        children: [
          Padding(padding: const EdgeInsets.symmetric(horizontal: 40), child: CoverImage(path: 'assets/covers/top_5.png', title: 'The Lycan King', aspect: 1, radius: 16)),
          const SizedBox(height: Gap.lg),
          Text('The Lycan King', textAlign: TextAlign.center, style: AppType.hero(size: 22, color: pal.ink)),
          Text('Episode 4 · Narrated by M. Stone', textAlign: TextAlign.center, style: AppType.body(size: 13, color: pal.muted)),
          const SizedBox(height: Gap.lg),
          // Chỉ thanh tiến trình rebuild theo vị trí phát.
          ValueListenableBuilder<Duration>(
            valueListenable: app.position,
            builder: (_, pos, __) {
              final durMs = app.duration.value.inMilliseconds;
              final progress = durMs > 0 ? (pos.inMilliseconds / durMs).clamp(0.0, 1.0) : 0.0;
              final buf = durMs > 0 ? (app.buffered.value.inMilliseconds / durMs).clamp(0.0, 1.0) : 0.0;
              return Column(children: [
                Slider(
                  value: progress.toDouble(),
                  secondaryTrackValue: buf.toDouble(),
                  activeColor: AppPalette.plum,
                  inactiveColor: pal.line,
                  secondaryActiveColor: AppPalette.plum.withValues(alpha: 0.3),
                  onChanged: durMs > 0 ? (v) => app.seek(Duration(milliseconds: (v * durMs).round())) : null,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text(formatClock(pos), style: AppType.meta(size: 11, color: pal.muted)),
                    Text(formatClock(app.duration.value), style: AppType.meta(size: 11, color: pal.muted)),
                  ]),
                ),
              ]);
            },
          ),
          const SizedBox(height: Gap.sm),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _pill(context, '1.0×'),
            IconButton(
              icon: Icon(Icons.replay_10, color: pal.ink, size: 30),
              onPressed: () => app.seek(app.position.value - const Duration(seconds: 10)),
            ),
            GestureDetector(
              onTap: app.togglePlay,
              child: Container(width: 64, height: 64, decoration: const BoxDecoration(color: AppPalette.plum, shape: BoxShape.circle), child: Icon(app.playing ? Icons.pause : Icons.play_arrow, color: Colors.white, size: 34)),
            ),
            IconButton(
              icon: Icon(Icons.forward_30, color: pal.ink, size: 30),
              onPressed: () => app.seek(app.position.value + const Duration(seconds: 30)),
            ),
            _pill(context, '😴'),
          ]),
          const SizedBox(height: Gap.xl),
          Text('Episodes', style: AppType.section(color: pal.ink)),
          const SizedBox(height: Gap.sm),
          for (var i = 1; i <= eps; i++)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Text('$i', style: AppType.item(size: 14, color: pal.muted)),
              title: Text('Episode $i', style: AppType.body(size: 14, color: pal.ink)),
              trailing: i <= 3
                  ? Icon(Icons.play_circle_outline, color: pal.soft)
                  : Container(width: 18, height: 18, decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [AppPalette.coinA, AppPalette.coinB]))),
            ),
          if (!_allEps)
            TextButton(onPressed: () => setState(() => _allEps = true), child: Text('Show all episodes', style: AppType.btn(size: 13, color: AppPalette.plum))),
        ],
      ),
    );
  }

  Widget _pill(BuildContext context, String s) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: context.pal.surf2, borderRadius: rounded(12), border: Border.all(color: context.pal.line)),
        child: Text(s, style: AppType.btn(size: 12, color: context.pal.amber)),
      );
}
