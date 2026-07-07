import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../state/auth_notifier.dart';
import '../theme/app_dimens.dart';
import '../theme/app_palette.dart';
import '../theme/app_type.dart';
import '../widgets/sheets.dart';

/// Profile (thiết kế anh/1/1.png): card hồ sơ + 3 thẻ stat + list cài đặt trong
/// card có kẻ ngăn + icon box + link hành động; footer Terms/Privacy/Sign out.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final app = context.watch<AppState>();
    final auth = context.watch<AuthNotifier>();
    final user = auth.user;
    final displayName = user?.name.isNotEmpty == true ? user!.name : (auth.isAuthenticated ? 'Bạn' : 'Khách');
    final vipText = (user?.isVip ?? app.vip) ? 'VIP Monthly' : 'Free';
    final email = user?.email ?? (auth.isAuthenticated ? '' : 'Chưa đăng nhập');
    final isVip = user?.isVip ?? app.vip;
    final initial = displayName.isNotEmpty ? displayName.substring(0, 1).toUpperCase() : 'N';
    final coins = auth.isAuthenticated ? (user?.pulseBalance ?? 0) : app.coins;

    return Scaffold(
      backgroundColor: pal.bg,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.lg, Gap.screenH, Gap.xxl),
          children: [
            // ── Card hồ sơ ──
            _card(
              context,
              child: Row(children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [AppPalette.terracotta, AppPalette.plum])),
                  alignment: Alignment.center,
                  child: Text(initial, style: AppType.hero(size: 26, color: Colors.white)),
                ),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(displayName, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.hero(size: 20, color: pal.ink)),
                    const SizedBox(height: 2),
                    Text('$email · $vipText', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(color: pal.muted)),
                  ]),
                ),
                if (isVip) ...[
                  const SizedBox(width: Gap.sm),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(color: pal.accentSurf, borderRadius: rounded(20)),
                    child: Text('VIP', style: AppType.btn(size: 12.5, color: AppPalette.terracotta)),
                  ),
                ],
              ]),
            ),
            const SizedBox(height: Gap.md),

            // ── 3 thẻ stat ──
            Row(children: [
              _stat(context, '$coins', 'Coins', null),
              const SizedBox(width: Gap.md),
              _stat(context, '${app.streak}', 'Streak', '🔥'),
              const SizedBox(width: Gap.md),
              _stat(context, '${app.likedSongs.length}', 'Library', null),
            ]),
            const SizedBox(height: Gap.md),

            // ── List cài đặt (card có kẻ ngăn) ──
            _card(
              context,
              padding: EdgeInsets.zero,
              child: Column(children: [
                _row(context, Icons.person_outline, 'Account info', 'Hồ sơ · email · avatar', 'Edit', () => context.push('/edit-profile')),
                _divider(pal),
                _row(context, Icons.language, 'Language', 'UI & nội dung', 'Change', () => context.push('/language')),
                _divider(pal),
                _row(context, Icons.tune, 'Content Settings', 'Độ tuổi · nhạy cảm', 'Open', () => context.push('/content-settings')),
                _divider(pal),
                _row(context, Icons.account_balance_wallet_outlined, 'Wallet & Rewards', 'Coin · gói · nhiệm vụ', 'Open', () => context.push('/wallet')),
                _divider(pal),
                _row(context, Icons.star_border, 'Rate app', 'Đánh giá ứng dụng', 'Rate', () => showRatingSheet(context, 'NovelVerse')),
                _divider(pal),
                _row(context, Icons.brush_outlined, 'Become an Author', 'Xuất bản & kiếm tiền', 'Open', () => context.push('/become-author')),
                _divider(pal),
                _row(context, Icons.copyright_outlined, 'Claim Copyright', 'Báo cáo bản quyền', 'Open', () => context.push('/claim-copyright')),
                _divider(pal),
                _row(context, Icons.help_outline, 'Help Center', 'Hỗ trợ · refund', 'Open', () {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Help center — coming soon')));
                }),
              ]),
            ),
            const SizedBox(height: Gap.md),

            // ── Dark theme + Replay onboarding (card) ──
            _card(
              context,
              padding: EdgeInsets.zero,
              child: Column(children: [
                SwitchListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: Gap.md),
                  value: app.isDark,
                  activeTrackColor: AppPalette.terracotta,
                  secondary: _iconBox(context, Icons.dark_mode_outlined),
                  title: Text('Dark theme', style: AppType.item(size: 14.5, color: pal.ink)),
                  onChanged: (_) => app.toggleTheme(),
                ),
                _divider(pal),
                _row(context, Icons.slideshow_outlined, 'Replay onboarding', 'Xem lại giới thiệu', 'Open', () => context.push('/onboarding')),
              ]),
            ),
            const SizedBox(height: Gap.xl),

            // ── Footer ──
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 16,
              children: [
                _footerLink(context, 'Terms of Use ↗'),
                _footerLink(context, 'Privacy Policy ↗'),
              ],
            ),
            const SizedBox(height: Gap.md),
            Center(
              child: TextButton(
                onPressed: () async {
                  if (auth.isAuthenticated) {
                    await auth.logout();
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã đăng xuất')));
                  } else {
                    context.push('/login');
                  }
                },
                child: Text(auth.isAuthenticated ? 'Sign out · Đăng xuất' : 'Đăng nhập',
                    style: AppType.btn(size: 14, color: auth.isAuthenticated ? pal.muted : AppPalette.terracotta)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card(BuildContext context, {required Widget child, EdgeInsets? padding}) {
    final pal = context.pal;
    return Container(
      padding: padding ?? const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: pal.card,
        borderRadius: rounded(18),
        border: Border.all(color: pal.line),
      ),
      child: child,
    );
  }

  Widget _stat(BuildContext context, String value, String label, String? emoji) {
    final pal = context.pal;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: Gap.md),
        decoration: BoxDecoration(color: pal.surf, borderRadius: rounded(Radii.card), border: Border.all(color: pal.line)),
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            if (emoji != null) ...[Text(emoji, style: const TextStyle(fontSize: 18)), const SizedBox(width: 4)],
            Text(value, style: AppType.hero(size: 22, color: pal.ink)),
          ]),
          const SizedBox(height: 2),
          Text(label, style: AppType.meta(size: 12, color: pal.muted)),
        ]),
      ),
    );
  }

  Widget _iconBox(BuildContext context, IconData icon) {
    final pal = context.pal;
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(color: pal.surf, borderRadius: rounded(12)),
      alignment: Alignment.center,
      child: Icon(icon, size: 20, color: pal.soft),
    );
  }

  Widget _row(BuildContext context, IconData icon, String title, String subtitle, String action, VoidCallback onTap) {
    final pal = context.pal;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(Gap.md),
        child: Row(children: [
          _iconBox(context, icon),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: AppType.item(size: 14.5, color: pal.ink)),
              const SizedBox(height: 2),
              Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 11.5, color: pal.muted)),
            ]),
          ),
          const SizedBox(width: Gap.sm),
          Text('$action ›', style: AppType.btn(size: 13, color: AppPalette.terracotta)),
        ]),
      ),
    );
  }

  Widget _divider(AppPalette pal) => Divider(height: 1, thickness: 1, color: pal.line2, indent: Gap.md, endIndent: Gap.md);

  Widget _footerLink(BuildContext context, String label) =>
      Text(label, style: AppType.meta(size: 12.5, color: context.pal.muted));
}
