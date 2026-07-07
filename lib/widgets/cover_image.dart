import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_type.dart';

/// Bìa truyện/nhạc. Thử load asset; CHƯA có ảnh → placeholder gradient + tên
/// (để prototype vẫn đẹp khi chưa bỏ ảnh vào assets/covers/).
class CoverImage extends StatelessWidget {
  const CoverImage({
    super.key,
    required this.path,
    required this.title,
    this.radius = 10,
    this.aspect = 3 / 4,
  });

  final String path, title;
  final double radius, aspect;

  static const _grads = [
    [Color(0xFFC2683A), Color(0xFF7A3B20)],
    [Color(0xFF7A5470), Color(0xFF3E2A3A)],
    [Color(0xFF4E6E58), Color(0xFF2A3D30)],
    [Color(0xFF2A4A6E), Color(0xFF16283C)],
    [Color(0xFF8A5A2B), Color(0xFF4A2F14)],
    [Color(0xFF9A3B4A), Color(0xFF551F28)],
  ];

  bool get _isNetwork => path.startsWith('http://') || path.startsWith('https://');

  @override
  Widget build(BuildContext context) {
    // Decode ở ~kích thước hiển thị (theo DPR) thay vì full-res — giảm giật khi cuộn.
    final cacheW = (260 * MediaQuery.devicePixelRatioOf(context)).round();
    // URL backend (thumbnailUrl R2) → Image.network; path asset → Image.asset.
    // Thiếu/lỗi ảnh đều rơi về placeholder gradient.
    final Widget img = _isNetwork
        // Cache ảnh ra ĐĨA (cached_network_image) → không tải lại mỗi lần cuộn → hết giật.
        ? CachedNetworkImage(
            imageUrl: path,
            fit: BoxFit.cover,
            memCacheWidth: cacheW,
            maxWidthDiskCache: cacheW,
            fadeInDuration: const Duration(milliseconds: 150),
            placeholder: (_, __) => _placeholder(),
            errorWidget: (_, __, ___) => _placeholder(),
          )
        : Image.asset(
            path,
            fit: BoxFit.cover,
            gaplessPlayback: true,
            cacheWidth: cacheW,
            errorBuilder: (_, __, ___) => _placeholder(),
          );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: AspectRatio(aspectRatio: aspect, child: img),
    );
  }

  Widget _placeholder() {
    final g = _grads[title.hashCode.abs() % _grads.length];
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: g,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(10),
      child: Text(
        title,
        maxLines: 3,
        textAlign: TextAlign.center,
        overflow: TextOverflow.ellipsis,
        style: AppType.serif(size: 13, w: FontWeight.w700, color: Colors.white, height: 1.2),
      ),
    );
  }
}
