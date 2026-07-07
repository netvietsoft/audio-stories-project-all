import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../models/demo_data.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

class AudioChartsScreen extends StatelessWidget {
  const AudioChartsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      backgroundColor: pal.bg,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.lg, Gap.screenH, Gap.xxl),
          children: [
            Text('Charts', style: AppType.hero(size: 26, color: pal.ink)),
            const SizedBox(height: Gap.md),
            ...Demo.charts.asMap().entries.map((e) {
              final rank = e.key + 1;
              final c = e.value;
              final rc = rank == 1 ? AppPalette.rank1 : rank == 2 ? AppPalette.rank2 : rank == 3 ? AppPalette.rank3 : pal.muted;
              return InkWell(
                borderRadius: rounded(10),
                onTap: () => context.push('/album/${e.key}'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Row(children: [
                    SizedBox(width: 28, child: Text('$rank', style: AppType.hero(size: 22, color: rc))),
                    SizedBox(width: 56, child: CoverImage(path: c.cover, title: c.title, aspect: 1, radius: 10)),
                    const SizedBox(width: Gap.md),
                    Expanded(child: Text(c.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppType.item(size: 14, color: pal.ink))),
                    const Icon(Icons.play_circle_fill, color: AppPalette.plum, size: 28),
                  ]),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
