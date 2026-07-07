import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_dimens.dart';
import '../theme/app_palette.dart';
import '../theme/app_type.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Timer(const Duration(milliseconds: 1100), () {
      if (mounted) context.go('/home');
    });
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                borderRadius: rounded(22),
                gradient: const LinearGradient(
                  colors: [AppPalette.terracotta, Color(0xFF9A5A2A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: const [
                  BoxShadow(color: Color(0x52C2683A), blurRadius: 24, offset: Offset(0, 10)),
                ],
              ),
              alignment: Alignment.center,
              child: Text('N', style: AppType.hero(size: 46, color: Colors.white)),
            ),
            const SizedBox(height: Gap.xl),
            Text('NovelVerse', style: AppType.hero(size: 30, color: pal.ink)),
            const SizedBox(height: Gap.sm),
            Text('Read · Listen · Escape',
                style: AppType.meta(size: 13, color: pal.muted)),
            const SizedBox(height: 44),
            SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppPalette.terracotta,
                backgroundColor: pal.line,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
