import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/offline/download_manager.dart';
import '../../data/offline/offline_store.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Màn "Đã tải": danh sách truyện đã lưu offline (tải thủ công + tự lưu),
/// tổng dung lượng, xoá từng truyện.
class DownloadsScreen extends StatefulWidget {
  const DownloadsScreen({super.key});
  @override
  State<DownloadsScreen> createState() => _DownloadsScreenState();
}

class _DownloadsScreenState extends State<DownloadsScreen> {
  String _mb(int b) => '${(b / (1024 * 1024)).toStringAsFixed(1)} MB';

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    context.watch<DownloadManager>(); // rebuild khi tải xong
    final store = context.read<OfflineStore>();
    final items = store.listDownloads()..sort((a, b) => b.lastAccessAt.compareTo(a.lastAccessAt));
    final totalDl = store.totalBytes('downloaded');
    final totalAuto = store.totalBytes('auto');

    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(title: const Text('Đã tải'), backgroundColor: pal.bg),
      body: items.isEmpty
          ? Center(child: Text('Chưa có truyện nào được lưu', style: AppType.body(size: 14, color: pal.muted)))
          : ListView(
              padding: const EdgeInsets.all(Gap.screenH),
              children: [
                Text('Đã tải ${_mb(totalDl)}  ·  Tự lưu ${_mb(totalAuto)}', style: AppType.meta(size: 12.5, color: pal.muted)),
                const SizedBox(height: Gap.md),
                for (final r in items) Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Row(children: [
                    SizedBox(width: 54, child: CoverImage(path: r.cover, title: r.title, radius: 10)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(r.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 15, color: pal.ink)),
                      const SizedBox(height: 3),
                      Text('${r.savedChapters}/${r.totalChapters} chương · ${_mb(r.totalBytes)}${r.kind == 'auto' ? ' · tự lưu' : ''}',
                          style: AppType.meta(size: 12, color: pal.muted)),
                    ])),
                    IconButton(
                      icon: Icon(Icons.delete_outline, color: pal.muted),
                      onPressed: () async { await store.deleteStory(r.storyId); setState(() {}); },
                    ),
                  ]),
                ),
              ],
            ),
    );
  }
}
