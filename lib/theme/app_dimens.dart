import 'package:flutter/widgets.dart';

/// Spacing + bo góc (handoff 01-design-system).
abstract final class Gap {
  static const screenH = 16.0; // padding ngang màn
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 22.0;
  static const xxl = 32.0;
}

abstract final class Radii {
  static const card = 13.0;
  static const cover = 10.0;
  static const button = 13.0;
  static const pill = 20.0;
  static const sheet = 22.0;
}

/// Bo góc tròn dùng nhanh.
BorderRadius rounded(double r) => BorderRadius.circular(r);
