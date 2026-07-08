import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/offline/connectivity_service.dart';
import '../theme/app_type.dart';

/// Thanh mỏng hiện khi mất kết nối, nhắc chỉ dùng được nội dung đã lưu offline.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final online = context.watch<ConnectivityService>().isOnline;
    if (online) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: const Color(0xFF8A5A44),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
      child: Text('Đang offline — chỉ nội dung đã lưu',
          textAlign: TextAlign.center, style: AppType.meta(size: 12, color: Colors.white)),
    );
  }
}
