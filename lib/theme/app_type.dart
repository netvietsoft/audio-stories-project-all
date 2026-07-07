import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Typography NovelVerse: Spectral (serif, tiêu đề/tên truyện) + Figtree (sans, UI).
/// Màu để null = kế thừa màu chữ mặc định (ink) từ theme.
abstract final class AppType {
  // Spectral — tiêu đề
  static TextStyle hero({double size = 28, Color? color}) =>
      GoogleFonts.spectral(fontSize: size, fontWeight: FontWeight.w700, color: color, height: 1.12);
  static TextStyle section({Color? color}) =>
      GoogleFonts.spectral(fontSize: 16, fontWeight: FontWeight.w700, color: color);
  static TextStyle serif({double size = 17, FontWeight w = FontWeight.w400, Color? color, double height = 1.78}) =>
      GoogleFonts.spectral(fontSize: size, fontWeight: w, color: color, height: height);

  // Figtree — UI
  static TextStyle item({double size = 13, Color? color}) =>
      GoogleFonts.figtree(fontSize: size, fontWeight: FontWeight.w700, color: color);
  static TextStyle body({double size = 14, FontWeight w = FontWeight.w400, Color? color}) =>
      GoogleFonts.figtree(fontSize: size, fontWeight: w, color: color, height: 1.4);
  static TextStyle meta({double size = 11.5, Color? color}) =>
      GoogleFonts.figtree(fontSize: size, fontWeight: FontWeight.w600, color: color);
  static TextStyle btn({double size = 14, Color? color}) =>
      GoogleFonts.figtree(fontSize: size, fontWeight: FontWeight.w700, color: color);
  static TextStyle tabLabel({Color? color}) =>
      GoogleFonts.figtree(fontSize: 11, fontWeight: FontWeight.w800, color: color);
}
