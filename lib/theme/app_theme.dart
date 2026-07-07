import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_palette.dart';

/// ThemeData sáng + tối cho NovelVerse. Gắn AppPalette làm ThemeExtension
/// (token màu) + font UI mặc định Figtree, màu chữ mặc định = ink.
abstract final class AppTheme {
  static ThemeData light() => _build(AppPalette.light, Brightness.light);
  static ThemeData dark() => _build(AppPalette.dark, Brightness.dark);

  static ThemeData _build(AppPalette pal, Brightness brightness) {
    final base = ThemeData(brightness: brightness, useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: pal.bg,
      extensions: [pal],
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppPalette.terracotta,
        brightness: brightness,
      ).copyWith(surface: pal.bg),
      textTheme: GoogleFonts.figtreeTextTheme(base.textTheme).apply(
        bodyColor: pal.ink,
        displayColor: pal.ink,
      ),
      splashFactory: InkRipple.splashFactory,
    );
  }
}
