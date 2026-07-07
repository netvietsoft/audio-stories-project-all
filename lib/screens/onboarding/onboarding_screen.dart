import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../models/demo_data.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';

/// Luồng onboarding (UI prototype): Language → Welcome → Genre → Reward →
/// Paywall. PageView 5 bước; Skip/Get Started → Home.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pc = PageController();
  int _i = 0;
  final _langs = <String>{'English'};
  final _genres = <String>{};
  int _plan = 1;

  void _next() {
    if (_i >= 4) {
      context.go('/home');
    } else {
      _pc.nextPage(duration: const Duration(milliseconds: 280), curve: Curves.easeOut);
    }
  }

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      backgroundColor: pal.bg,
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.go('/home'),
                child: Text('Skip', style: AppType.btn(size: 13, color: pal.muted)),
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pc,
                onPageChanged: (v) => setState(() => _i = v),
                children: [
                  _language(pal),
                  _welcome(pal),
                  _genre(pal),
                  _reward(pal),
                  _paywall(pal),
                ],
              ),
            ),
            // dots
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < 5; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _i ? 20 : 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: i == _i ? AppPalette.terracotta : pal.line,
                      borderRadius: rounded(4),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(Gap.lg),
              child: GestureDetector(
                onTap: _next,
                child: Container(
                  height: 50,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: AppPalette.terracotta, borderRadius: rounded(Radii.button)),
                  child: Text(_i >= 4 ? 'Get Started' : 'Continue', style: AppType.btn(color: Colors.white)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pad(Widget child) => Padding(padding: const EdgeInsets.symmetric(horizontal: Gap.xl), child: child);

  Widget _language(AppPalette pal) => _pad(Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('Choose your language', style: AppType.hero(size: 26, color: pal.ink)),
          const SizedBox(height: Gap.lg),
          Wrap(spacing: 10, runSpacing: 10, children: [
            for (final l in ['English', 'Tiếng Việt', '中文', '한국어', 'Español', 'Français'])
              _chip(pal, l, _langs.contains(l), () => setState(() => _langs.contains(l) ? _langs.remove(l) : _langs.add(l))),
          ]),
        ],
      ));

  Widget _welcome(AppPalette pal) => _pad(Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80, height: 80,
            decoration: BoxDecoration(borderRadius: rounded(20), gradient: const LinearGradient(colors: [AppPalette.terracotta, Color(0xFF9A5A2A)])),
            alignment: Alignment.center,
            child: Text('N', style: AppType.hero(size: 40, color: Colors.white)),
          ),
          const SizedBox(height: Gap.lg),
          Text('Welcome to NovelVerse', style: AppType.hero(size: 24, color: pal.ink), textAlign: TextAlign.center),
          const SizedBox(height: Gap.xl),
          for (final m in ['Continue with Google', 'Continue with Apple', 'Continue with Email', 'Continue as Guest'])
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: pal.card, borderRadius: rounded(12), border: Border.all(color: pal.line)),
              child: Text(m, style: AppType.btn(size: 14, color: pal.ink)),
            ),
        ],
      ));

  Widget _genre(AppPalette pal) => _pad(Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: Gap.lg),
          Text('Pick your genres', style: AppType.hero(size: 26, color: pal.ink)),
          Text('Choose at least 3 · +50 coins 🪙', style: AppType.meta(color: pal.muted)),
          const SizedBox(height: Gap.lg),
          Expanded(
            child: Wrap(spacing: 10, runSpacing: 10, children: [
              for (final g in Demo.genres)
                _chip(pal, g, _genres.contains(g), () => setState(() => _genres.contains(g) ? _genres.remove(g) : _genres.add(g))),
            ]),
          ),
        ],
      ));

  Widget _reward(AppPalette pal) => _pad(Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('🎁', style: const TextStyle(fontSize: 56)),
          const SizedBox(height: Gap.md),
          Text('7-Day Reward', style: AppType.hero(size: 26, color: pal.ink)),
          const SizedBox(height: Gap.lg),
          Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
            for (var d = 1; d <= 7; d++)
              Container(
                width: 64, height: 64,
                decoration: BoxDecoration(
                  color: d == 6 ? AppPalette.terracotta : pal.surf2,
                  borderRadius: rounded(12),
                  border: Border.all(color: pal.line),
                ),
                alignment: Alignment.center,
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('Day $d', style: AppType.meta(size: 10, color: d == 6 ? Colors.white : pal.muted)),
                  Text('+${d * 10}', style: AppType.item(size: 13, color: d == 6 ? Colors.white : pal.amber)),
                ]),
              ),
          ]),
        ],
      ));

  Widget _paywall(AppPalette pal) => _pad(Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('Go VIP', style: AppType.hero(size: 28, color: pal.ink)),
          Text('Unlimited reading & listening', style: AppType.body(size: 14, color: pal.muted)),
          const SizedBox(height: Gap.lg),
          for (var i = 0; i < Demo.plans.length; i++)
            GestureDetector(
              onTap: () => setState(() => _plan = i),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(Gap.md),
                decoration: BoxDecoration(
                  color: pal.card,
                  borderRadius: rounded(12),
                  border: Border.all(color: _plan == i ? AppPalette.terracotta : pal.line, width: _plan == i ? 2 : 1),
                ),
                child: Row(children: [
                  Icon(_plan == i ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: _plan == i ? AppPalette.terracotta : pal.muted, size: 20),
                  const SizedBox(width: 10),
                  Expanded(child: Text(Demo.plans[i].name, style: AppType.item(size: 14, color: pal.ink))),
                  Text(Demo.plans[i].price, style: AppType.meta(color: pal.muted)),
                ]),
              ),
            ),
        ],
      ));

  Widget _chip(AppPalette pal, String label, bool active, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: active ? AppPalette.terracotta : pal.surf2,
            borderRadius: rounded(20),
            border: Border.all(color: active ? AppPalette.terracotta : pal.line),
          ),
          child: Text(label, style: AppType.btn(size: 13, color: active ? Colors.white : pal.amber)),
        ),
      );
}
