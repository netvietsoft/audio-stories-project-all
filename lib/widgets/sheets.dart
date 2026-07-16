import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/demo_data.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../theme/app_dimens.dart';
import '../theme/app_palette.dart';
import '../theme/app_type.dart';

/// Bottom-sheet dùng chung toàn app (handoff 02-components "Bottom sheet"):
/// radius 22px trên, handle 38×4, overlay tối. Mỗi hàm show* tự dựng nội dung.

Future<T?> _showSheet<T>(BuildContext context, WidgetBuilder body) {
  final pal = context.pal;
  return showModalBottomSheet<T>(
    context: context,
    backgroundColor: pal.card,
    barrierColor: const Color(0x80201608),
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet)),
    ),
    builder: (c) => Padding(
      // chừa chỗ cho bàn phím khi có TextField
      padding: EdgeInsets.only(bottom: MediaQuery.of(c).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 10),
          Container(width: 38, height: 4, decoration: BoxDecoration(color: pal.line, borderRadius: rounded(2))),
          const SizedBox(height: 6),
          Flexible(child: body(c)),
        ]),
      ),
    ),
  );
}

/// Popup mở khóa chương: coin / free pass / xem quảng cáo / tự động.
/// Trả về true nếu chương được mở.
Future<bool> showUnlockSheet(BuildContext context, Book book, Chapter ch) async {
  final app = context.read<AppState>();
  final ok = await _showSheet<bool>(context, (c) {
    final pal = context.pal;
    Widget opt(IconData icon, String title, String sub, Color color, VoidCallback onTap) => InkWell(
          onTap: onTap,
          borderRadius: rounded(14),
          child: Container(
            margin: const EdgeInsets.only(bottom: Gap.sm),
            padding: const EdgeInsets.all(Gap.md),
            decoration: BoxDecoration(color: pal.surf2, borderRadius: rounded(14), border: Border.all(color: pal.line)),
            child: Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: rounded(10)),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: AppType.item(size: 14, color: pal.ink)),
                  Text(sub, style: AppType.meta(size: 11, color: pal.muted)),
                ]),
              ),
              Icon(Icons.chevron_right, color: pal.muted),
            ]),
          ),
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, Gap.xl),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.lock_outline, color: AppPalette.terracotta, size: 20),
          const SizedBox(width: 8),
          Expanded(child: Text('Unlock Chapter ${ch.n}', style: AppType.section(color: pal.ink))),
        ]),
        const SizedBox(height: 2),
        Text(ch.title, style: AppType.meta(size: 12, color: pal.muted)),
        const SizedBox(height: Gap.lg),
        opt(Icons.monetization_on_outlined, 'Use ${ch.price} coins', 'Balance: ${app.coins} coins', AppPalette.coinB, () {
          if (app.spendCoins(ch.price)) {
            Navigator.pop(c, true);
          } else {
            Navigator.pop(c, false);
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Not enough coins — top up first')));
          }
        }),
        opt(Icons.card_giftcard_outlined, 'Use a free pass', '2 passes left this week', AppPalette.plum, () => Navigator.pop(c, true)),
        opt(Icons.play_circle_outline, 'Watch an ad', 'Unlock this chapter for free', pal.sage, () => Navigator.pop(c, true)),
        opt(Icons.bolt_outlined, 'Auto-unlock next chapters', 'Spend coins automatically', AppPalette.terracotta, () => Navigator.pop(c, true)),
      ]),
    );
  });
  if (ok == true) app.unlockChapter(book.id, ch.n);
  return ok == true;
}

/// Popup tặng quà cho tác giả (Support). Trừ coin theo quà chọn.
Future<void> showGiftSheet(BuildContext context, String author) {
  final app = context.read<AppState>();
  return _showSheet<void>(context, (c) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, Gap.xl),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Support $author', style: AppType.section(color: pal.ink)),
        Text('Send a gift to encourage the author', style: AppType.meta(size: 12, color: pal.muted)),
        const SizedBox(height: Gap.lg),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          mainAxisSpacing: Gap.md,
          crossAxisSpacing: Gap.md,
          childAspectRatio: 0.92,
          children: Demo.gifts.map((g) => InkWell(
                borderRadius: rounded(14),
                onTap: () {
                  final ok = app.spendCoins(g.coins);
                  Navigator.pop(c);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok ? 'Sent ${g.emoji} ${g.name} to $author!' : 'Not enough coins for ${g.name}'),
                  ));
                },
                child: Container(
                  decoration: BoxDecoration(color: pal.surf2, borderRadius: rounded(14), border: Border.all(color: pal.line)),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(g.emoji, style: const TextStyle(fontSize: 28)),
                    const SizedBox(height: 6),
                    Text(g.name, style: AppType.item(size: 12, color: pal.ink)),
                    Text('${g.coins} 🪙', style: AppType.meta(size: 11, color: pal.amber)),
                  ]),
                ),
              )).toList(),
        ),
      ]),
    );
  });
}

/// Popup đánh giá sao: ≤3★ cảm ơn, ≥4★ gợi ý ra store.
Future<void> showRatingSheet(BuildContext context, String title) {
  var rating = 0;
  return _showSheet<void>(context, (c) {
    final pal = context.pal;
    return StatefulBuilder(builder: (c, setSheet) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, Gap.xl),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Rate "$title"', style: AppType.section(color: pal.ink)),
          const SizedBox(height: Gap.lg),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 1; i <= 5; i++)
              IconButton(
                icon: Icon(i <= rating ? Icons.star : Icons.star_border,
                    color: AppPalette.rank3, size: 34),
                onPressed: () => setSheet(() => rating = i),
              ),
          ]),
          const SizedBox(height: Gap.sm),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              style: TextButton.styleFrom(backgroundColor: AppPalette.terracotta, padding: const EdgeInsets.symmetric(vertical: 13)),
              onPressed: rating == 0
                  ? null
                  : () {
                      Navigator.pop(c);
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(rating >= 4 ? 'Thanks! Opening the app store…' : 'Thanks for your feedback 💛'),
                      ));
                    },
              child: Text('Submit', style: AppType.btn(color: Colors.white)),
            ),
          ),
        ]),
      );
    });
  });
}
