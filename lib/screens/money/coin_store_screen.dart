import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../models/demo_data.dart';
import '../../models/models.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';

class CoinStoreScreen extends StatefulWidget {
  const CoinStoreScreen({super.key});

  @override
  State<CoinStoreScreen> createState() => _CoinStoreScreenState();
}

class _CoinStoreScreenState extends State<CoinStoreScreen> {
  int _selected = 1;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.arrow_back, color: pal.ink), onPressed: () => context.pop()),
        title: Text('Coin Store', style: AppType.section(color: pal.ink)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.05,
            crossAxisSpacing: Gap.md,
            mainAxisSpacing: Gap.md,
            children: [
              for (var i = 0; i < Demo.coinPacks.length; i++) _packCard(context, i, Demo.coinPacks[i]),
            ],
          ),
          const SizedBox(height: Gap.lg),
          Text('Synced with your web purchases', textAlign: TextAlign.center, style: AppType.meta(color: pal.muted)),
          const SizedBox(height: Gap.lg),
          GestureDetector(
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Buy ${Demo.coinPacks[_selected].coins} coins (demo)'), duration: const Duration(seconds: 1))),
            child: Container(
              height: 50,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: AppPalette.terracotta, borderRadius: rounded(Radii.button)),
              child: Text('Buy ${Demo.coinPacks[_selected].coins} coins · ${Demo.coinPacks[_selected].price}', style: AppType.btn(color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _packCard(BuildContext context, int i, CoinPack p) {
    final pal = context.pal;
    final sel = _selected == i;
    return GestureDetector(
      onTap: () => setState(() => _selected = i),
      child: Container(
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: pal.card,
          borderRadius: rounded(Radii.card),
          border: Border.all(color: sel ? AppPalette.terracotta : pal.line, width: sel ? 2 : 1),
        ),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          if (p.label != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: pal.accentSurf, borderRadius: rounded(8)),
              child: Text(p.label!, style: AppType.tabLabel(color: AppPalette.terracotta)),
            ),
          const SizedBox(height: 8),
          Container(width: 30, height: 30, decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [AppPalette.coinA, AppPalette.coinB]))),
          const SizedBox(height: 6),
          Text(p.coins, style: AppType.hero(size: 20, color: pal.ink)),
          if (p.bonus != null) Text(p.bonus!, style: AppType.meta(size: 11, color: pal.sage)),
          const SizedBox(height: 4),
          Text(p.price, style: AppType.item(size: 14, color: pal.amber)),
        ]),
      ),
    );
  }
}
