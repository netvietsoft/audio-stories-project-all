import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';

/// Wallet & Rewards: số dư, Buy/Subscribe, check-in 7 ngày (streak), nhiệm vụ,
/// lịch sử giao dịch. Prototype — nhận coin bằng nút (cộng vào AppState).
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final app = context.watch<AppState>();

    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.arrow_back, color: pal.ink), onPressed: () => context.pop()),
        title: Text('Wallet & Rewards', style: AppType.section(color: pal.ink)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.screenH, 0, Gap.screenH, Gap.xxl),
        children: [
          // Balance card
          Container(
            padding: const EdgeInsets.all(Gap.lg),
            decoration: BoxDecoration(
              borderRadius: rounded(Radii.card),
              gradient: const LinearGradient(colors: [Color(0xFF3A1F2E), AppPalette.plum]),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Coin balance', style: AppType.meta(size: 12, color: Colors.white70)),
              const SizedBox(height: 4),
              Row(children: [
                Container(width: 22, height: 22, decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [AppPalette.coinA, AppPalette.coinB]))),
                const SizedBox(width: 8),
                Text('${app.coins}', style: AppType.hero(size: 30, color: Colors.white)),
              ]),
              const SizedBox(height: Gap.md),
              Row(children: [
                Expanded(child: _btn('Buy coins', Colors.white, AppPalette.plum, () => context.push('/coins'))),
                const SizedBox(width: Gap.md),
                Expanded(child: _btn('Subscribe', AppPalette.terracotta, Colors.white, () => context.push('/subscription'))),
              ]),
            ]),
          ),
          const SizedBox(height: Gap.xl),
          // Daily check-in (streak 7 ngày)
          Text('Daily check-in', style: AppType.section(color: pal.ink)),
          Text('${app.streak}-day streak 🔥', style: AppType.meta(color: pal.muted)),
          const SizedBox(height: Gap.sm),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            for (var d = 1; d <= 7; d++)
              Column(children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: d <= app.streak ? AppPalette.terracotta : pal.surf2,
                    border: Border.all(color: d <= app.streak ? AppPalette.terracotta : pal.line),
                  ),
                  child: Icon(d <= app.streak ? Icons.check : Icons.add,
                      size: 16, color: d <= app.streak ? Colors.white : pal.muted),
                ),
                const SizedBox(height: 4),
                Text('D$d', style: AppType.meta(size: 10, color: pal.muted)),
              ]),
          ]),
          const SizedBox(height: Gap.sm),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              style: TextButton.styleFrom(backgroundColor: AppPalette.terracotta, padding: const EdgeInsets.symmetric(vertical: 13)),
              onPressed: () {
                context.read<AppState>().addCoins(20);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('+20 coins claimed!')));
              },
              child: Text("Claim today's +20 coins", style: AppType.btn(color: Colors.white)),
            ),
          ),
          const SizedBox(height: Gap.xl),
          // Tasks
          Text('Earn more', style: AppType.section(color: pal.ink)),
          const SizedBox(height: Gap.sm),
          _task(context, Icons.play_circle_outline, 'Watch a video ad', '+15', () => context.read<AppState>().addCoins(15)),
          _task(context, Icons.menu_book_outlined, 'Read 3 chapters', '+30', () => context.read<AppState>().addCoins(30)),
          _task(context, Icons.share_outlined, 'Invite a friend', '+100', () => context.read<AppState>().addCoins(100)),
          const SizedBox(height: Gap.xl),
          // Transactions
          Text('Recent transactions', style: AppType.section(color: pal.ink)),
          const SizedBox(height: Gap.sm),
          _txn(context, 'Daily check-in', '+20', true),
          _txn(context, 'Unlock Ch.25 · The Lycan King', '-15', false),
          _txn(context, 'Coin pack · Popular', '+1,100', true),
          _txn(context, 'Gift · Coffee', '-30', false),
        ],
      ),
    );
  }

  Widget _btn(String label, Color bg, Color fg, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, borderRadius: rounded(11)),
          child: Text(label, style: AppType.btn(size: 13, color: fg)),
        ),
      );

  Widget _task(BuildContext context, IconData icon, String label, String reward, VoidCallback onTap) {
    final pal = context.pal;
    return Container(
      margin: const EdgeInsets.only(bottom: Gap.sm),
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(color: pal.surf2, borderRadius: rounded(14), border: Border.all(color: pal.line)),
      child: Row(children: [
        Icon(icon, color: pal.soft, size: 22),
        const SizedBox(width: Gap.md),
        Expanded(child: Text(label, style: AppType.item(size: 14, color: pal.ink))),
        GestureDetector(
          onTap: () {
            onTap();
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$reward coins added')));
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: AppPalette.terracotta, borderRadius: rounded(20)),
            child: Text('$reward 🪙', style: AppType.btn(size: 12, color: Colors.white)),
          ),
        ),
      ]),
    );
  }

  Widget _txn(BuildContext context, String label, String amount, bool credit) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.body(size: 13.5, color: pal.soft))),
        Text(amount, style: AppType.item(size: 14, color: credit ? pal.sage : AppPalette.rank1)),
      ]),
    );
  }
}
