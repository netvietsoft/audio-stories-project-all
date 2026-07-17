import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../data/repositories/banners_repository.dart';
import '../../../theme/app_dimens.dart';
import '../../../theme/app_palette.dart';

/// Carousel banner Home (admin quản qua BE `GET /banners`, bảng HeroBanner).
/// Tự trượt 5s + chấm trang; 1 banner thì đứng yên. Bấm: banner gắn truyện
/// (`storySlug` != null) → mở chi tiết truyện trong app; không thì `targetUrl`
/// → trình duyệt ngoài; cả hai null → không bấm được.
class HomeBannerCarousel extends StatefulWidget {
  const HomeBannerCarousel({super.key, required this.banners});
  final List<AppBanner> banners;

  @override
  State<HomeBannerCarousel> createState() => _HomeBannerCarouselState();
}

class _HomeBannerCarouselState extends State<HomeBannerCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _startTimerIfNeeded();
  }

  @override
  void didUpdateWidget(covariant HomeBannerCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Số banner đổi sau rebuild (vd pull-to-refresh): 1→nhiều cần bật auto-slide,
    // nhiều→1 phải tắt timer thừa.
    if (widget.banners.length != oldWidget.banners.length) {
      _timer?.cancel();
      _timer = null;
      _startTimerIfNeeded();
    }
  }

  void _startTimerIfNeeded() {
    if (widget.banners.length <= 1) return;
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_controller.hasClients) return;
      final next = (_page + 1) % widget.banners.length;
      _controller.animateToPage(next, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _open(AppBanner b) {
    final slug = b.storySlug;
    if (slug != null) {
      context.push('/book/$slug');
      return;
    }
    final target = b.targetUrl;
    if (target == null) return;
    try {
      launchUrl(Uri.parse(target), mode: LaunchMode.externalApplication).catchError((_) => false);
    } catch (_) {/* URL không hợp lệ → nuốt lỗi */}
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.lg, Gap.screenH, 0),
      child: Column(children: [
        AspectRatio(
          aspectRatio: 2.5,
          child: ClipRRect(
            borderRadius: rounded(18),
            child: PageView.builder(
              controller: _controller,
              onPageChanged: (i) => setState(() => _page = i),
              itemCount: widget.banners.length,
              itemBuilder: (_, i) {
                final b = widget.banners[i];
                final canOpen = b.storySlug != null || b.targetUrl != null;
                return GestureDetector(
                  onTap: canOpen ? () => _open(b) : null,
                  child: CachedNetworkImage(
                    imageUrl: b.imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(color: pal.surf),
                    errorWidget: (_, __, ___) => Container(color: pal.surf),
                  ),
                );
              },
            ),
          ),
        ),
        if (widget.banners.length > 1) ...[
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < widget.banners.length; i++)
              Container(
                width: i == _page ? 16 : 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  color: i == _page ? AppPalette.terracotta : pal.line,
                  borderRadius: rounded(3),
                ),
              ),
          ]),
        ],
      ]),
    );
  }
}
