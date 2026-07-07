import 'package:flutter/material.dart';

/// Token màu NovelVerse (handoff 01-design-system) — Light + Dark.
/// Dùng qua `context.pal` (xem extension cuối file).
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.bg,
    required this.bg2,
    required this.card,
    required this.ink,
    required this.soft,
    required this.muted,
    required this.line,
    required this.line2,
    required this.surf,
    required this.surf2,
    required this.accentSurf,
    required this.plumSurf,
    required this.sageSurf,
    required this.amber,
    required this.sage,
  });

  final Color bg, bg2, card, ink, soft, muted, line, line2, surf, surf2;
  final Color accentSurf, plumSurf, sageSurf, amber, sage;

  // ── Brand (cố định, KHÔNG đổi theo theme) ──
  static const terracotta = Color(0xFFC2683A); // CTA chính Novel
  static const terracottaDark = Color(0xFFA8542C);
  static const plum = Color(0xFF7A5470); // Audio
  static const coinA = Color(0xFFE6C04A);
  static const coinB = Color(0xFFC9962B);
  static const rank1 = Color(0xFFE0403A);
  static const rank2 = Color(0xFFE8821A);
  static const rank3 = Color(0xFFE6B800);

  static const light = AppPalette(
    bg: Color(0xFFFBF3E3), bg2: Color(0xFFFFF8ED), card: Color(0xFFFFFFFF),
    ink: Color(0xFF2A2118), soft: Color(0xFF5B4F3A), muted: Color(0xFF9A8C72),
    line: Color(0xFFEADFC6), line2: Color(0xFFF2E8D2), surf: Color(0xFFF4E7CC),
    surf2: Color(0xFFFBF4E4), accentSurf: Color(0xFFF6E3D6), plumSurf: Color(0xFFF0E6F0),
    sageSurf: Color(0xFFEAF1E2), amber: Color(0xFF8A5A2B), sage: Color(0xFF4E6E58),
  );

  static const dark = AppPalette(
    bg: Color(0xFF15110C), bg2: Color(0xFF1A150F), card: Color(0xFF231D15),
    ink: Color(0xFFF3E9D6), soft: Color(0xFFCBBCA0), muted: Color(0xFF9C8F76),
    line: Color(0xFF352818), line2: Color(0xFF2B2117), surf: Color(0xFF302516),
    surf2: Color(0xFF251E14), accentSurf: Color(0xFF3C2718), plumSurf: Color(0xFF2C2031),
    sageSurf: Color(0xFF23312B), amber: Color(0xFFD9A45E), sage: Color(0xFF83B193),
  );

  @override
  AppPalette copyWith() => this;

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) =>
      t < 0.5 ? this : (other as AppPalette? ?? this);
}

extension PaletteX on BuildContext {
  AppPalette get pal => Theme.of(this).extension<AppPalette>()!;
}
