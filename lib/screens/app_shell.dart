import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n_ext.dart';
import '../state/app_state.dart';
import '../theme/app_palette.dart';
import '../theme/app_type.dart';
import 'audio/audio_charts_screen.dart';
import 'audio/audio_home_screen.dart';
import 'audio/audio_library_screen.dart';
import 'novel/discover_screen.dart';
import 'novel/novel_home_screen.dart';
import 'novel/trending_screen.dart';
import 'profile_screen.dart';

/// Khung chính: IndexedStack 4 tab + bottom nav (đổi màu theo chế độ) +
/// mini-player toàn cục (hiện khi đang phát).
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  @override
  Widget build(BuildContext context) {
    // select: shell CHỈ rebuild khi đổi chế độ / tab / bật-tắt mini-player.
    final mode = context.select<AppState, AppMode>((a) => a.mode);
    final hasPlaying = context.select<AppState, bool>((a) => a.nowPlayingTitle != null);
    // Tab do AppState giữ (để màn đẩy như Reader điều hướng về đúng tab).
    final index = context.select<AppState, int>((a) => a.shellTab);
    final accent = mode == AppMode.novel ? AppPalette.terracotta : AppPalette.plum;

    final pages = mode == AppMode.novel
        ? const [NovelHomeScreen(), DiscoverScreen(), TrendingScreen(), ProfileScreen()]
        : const [AudioHomeScreen(), AudioLibraryScreen(), AudioChartsScreen(), ProfileScreen()];

    return Scaffold(
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasPlaying) const _MiniPlayer(),
          _BottomNav(
            index: index,
            accent: accent,
            audioMode: mode == AppMode.audio,
            onTap: (i) => context.read<AppState>().setShellTab(i),
          ),
        ],
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({required this.index, required this.accent, required this.audioMode, required this.onTap});
  final int index;
  final Color accent;
  final bool audioMode;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final t = context.l10n;
    final items = [
      ('home.png', audioMode ? t.navListen : t.navHome),
      ('discover.png', audioMode ? t.navLibrary : t.navDiscover),
      ('trending.png', audioMode ? t.navCharts : t.navTrending),
      ('profile.png', t.navProfile),
    ];
    return Container(
      decoration: BoxDecoration(
        color: pal.card,
        border: Border(top: BorderSide(color: pal.line)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 62,
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: InkWell(
                    onTap: () => onTap(i),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Image.asset(
                          'assets/icons/${items[i].$1}',
                          width: 22,
                          height: 22,
                          color: i == index ? accent : const Color(0xFFB6A98C),
                          colorBlendMode: BlendMode.srcIn,
                        ),
                        const SizedBox(height: 3),
                        Text(items[i].$2,
                            style: AppType.tabLabel(
                                color: i == index ? accent : const Color(0xFFB6A98C))),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniPlayer extends StatelessWidget {
  const _MiniPlayer();

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [Color(0xFF3A1F2E), AppPalette.plum]),
      ),
      child: Row(
        children: [
          Container(width: 38, height: 38, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(8))),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(app.nowPlayingTitle ?? '', maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: AppType.item(size: 13, color: Colors.white)),
                Text(app.nowPlayingAuthor ?? '', maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: AppType.meta(size: 11, color: Colors.white70)),
              ],
            ),
          ),
          IconButton(
            icon: Icon(app.playing ? Icons.pause : Icons.play_arrow, color: Colors.white),
            onPressed: app.togglePlay,
          ),
          IconButton(icon: const Icon(Icons.close, color: Colors.white70), onPressed: app.stop),
        ],
      ),
    );
  }
}
