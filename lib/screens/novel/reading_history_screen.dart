import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/reading_history/reading_history_store.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/cover_image.dart';

/// Danh sách truyện ĐANG ĐỌC DỞ (đích nút "More..." cạnh Continue Reading).
/// Đọc từ ReadingHistoryStore local — mở tức thì, không network.
/// Card layout (chốt với user): thumb trái to · tiêu đề · tóm tắt 20 từ ·
/// progress bar · "Chương x / y" · thể loại (trái) + reads (phải).
class ReadingHistoryScreen extends StatefulWidget {
  const ReadingHistoryScreen({super.key});

  @override
  State<ReadingHistoryScreen> createState() => _ReadingHistoryScreenState();
}

class _ReadingHistoryScreenState extends State<ReadingHistoryScreen> {
  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final entries = context.read<ReadingHistoryStore>().entries();
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        iconTheme: IconThemeData(color: pal.ink),
        title: Text('Đang đọc', style: AppType.section(color: pal.ink)),
      ),
      body: entries.isEmpty
          ? Center(child: Text('Chưa có truyện đang đọc', style: AppType.body(size: 14, color: pal.muted)))
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.md, Gap.screenH, Gap.xxl),
              itemCount: entries.length,
              separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
              itemBuilder: (_, i) => _card(context, entries[i]),
            ),
    );
  }

  Widget _card(BuildContext context, ReadingHistoryEntry e) {
    final pal = context.pal;
    final progress = e.totalChapters > 0 ? (e.chapter / e.totalChapters).clamp(0.0, 1.0) : 0.0;
    return GestureDetector(
      onTap: () async {
        await context.push('/reader/${e.bookId}?ch=${e.chapter}');
        if (mounted) setState(() {}); // back về → build đọc lại entries()
      },
      child: Container(
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: pal.card,
          borderRadius: rounded(Radii.card),
          border: Border.all(color: pal.line),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumb truyện TO NHẤT phía tay trái.
            SizedBox(width: 96, child: CoverImage(path: e.cover, title: e.title)),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: AppType.item(size: 15, color: pal.ink)),
                  if (e.synopsis.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(truncateWords(e.synopsis, 20), maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: AppType.body(size: 12.5, color: pal.muted)),
                  ],
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: rounded(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 6,
                      backgroundColor: pal.line,
                      color: AppPalette.terracotta,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text('Chương ${e.chapter} / ${e.totalChapters}',
                      style: AppType.meta(size: 11.5, color: pal.muted)),
                  const SizedBox(height: 6),
                  Row(children: [
                    if (e.genre.isNotEmpty)
                      Expanded(
                        child: Text(e.genre, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: AppType.meta(size: 11.5, color: pal.amber)),
                      )
                    else
                      const Spacer(),
                    if (e.reads.isNotEmpty)
                      Text('${e.reads} reads', style: AppType.meta(size: 11.5, color: pal.muted)),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
