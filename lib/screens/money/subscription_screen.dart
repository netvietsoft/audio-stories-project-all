import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../models/demo_data.dart';
import '../../models/models.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  int _selected = 1;

  static const _perks = ['Unlock all chapters', 'No ads', 'Early access', 'Exclusive audiobooks'];

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.close, color: pal.ink), onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
        children: [
          Center(child: Text('NovelVerse VIP', style: AppType.hero(size: 28, color: pal.ink))),
          const SizedBox(height: 4),
          Center(child: Text('Read & listen without limits', style: AppType.body(size: 14, color: pal.muted))),
          const SizedBox(height: Gap.xl),
          ..._perks.map((p) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  const Icon(Icons.check_circle, color: AppPalette.terracotta, size: 22),
                  const SizedBox(width: Gap.md),
                  Text(p, style: AppType.body(size: 15, color: pal.ink)),
                ]),
              )),
          const SizedBox(height: Gap.xl),
          for (var i = 0; i < Demo.plans.length; i++) _planCard(context, i, Demo.plans[i]),
          const SizedBox(height: Gap.lg),
          GestureDetector(
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Subscribe ${Demo.plans[_selected].name} (demo)'), duration: const Duration(seconds: 1))),
            child: Container(
              height: 50,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: AppPalette.terracotta, borderRadius: rounded(Radii.button)),
              child: Text('Start ${Demo.plans[_selected].name}', style: AppType.btn(color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _planCard(BuildContext context, int i, Plan p) {
    final pal = context.pal;
    final sel = _selected == i;
    return GestureDetector(
      onTap: () => setState(() => _selected = i),
      child: Container(
        margin: const EdgeInsets.only(bottom: Gap.md),
        padding: const EdgeInsets.all(Gap.lg),
        decoration: BoxDecoration(
          color: pal.card,
          borderRadius: rounded(Radii.card),
          border: Border.all(color: sel ? AppPalette.terracotta : pal.line, width: sel ? 2 : 1),
        ),
        child: Row(children: [
          Icon(sel ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: sel ? AppPalette.terracotta : pal.muted),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.name, style: AppType.item(size: 15, color: pal.ink)),
              Text(p.price, style: AppType.meta(color: pal.muted)),
            ]),
          ),
          if (p.popular)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(color: pal.accentSurf, borderRadius: rounded(10)),
              child: Text('Popular', style: AppType.tabLabel(color: AppPalette.terracotta)),
            ),
        ]),
      ),
    );
  }
}
