import 'package:hive/hive.dart';

import '../repositories/history_repository.dart';

/// 1 truyện đang đọc dở (entry lịch sử local — nguồn màn "Đang đọc" + sync).
class ReadingHistoryEntry {
  const ReadingHistoryEntry({
    required this.bookId,
    required this.storyUuid,
    required this.title,
    required this.cover,
    required this.synopsis,
    required this.genre,
    required this.reads,
    required this.totalChapters,
    required this.chapter,
    required this.savedAt,
  });

  final String bookId, title, cover, synopsis, genre, reads;
  final String? storyUuid;
  final int totalChapters, chapter, savedAt;

  Map<String, dynamic> toMap() => {
        'bookId': bookId, 'storyUuid': storyUuid, 'title': title, 'cover': cover,
        'synopsis': synopsis, 'genre': genre, 'reads': reads,
        'totalChapters': totalChapters, 'chapter': chapter, 'savedAt': savedAt,
      };

  factory ReadingHistoryEntry.fromMap(Map m) {
    int i(dynamic v, int d) => v is num ? v.toInt() : d;
    return ReadingHistoryEntry(
      bookId: (m['bookId'] ?? '').toString(),
      storyUuid: m['storyUuid']?.toString(),
      title: (m['title'] ?? '').toString(),
      cover: (m['cover'] ?? '').toString(),
      synopsis: (m['synopsis'] ?? '').toString(),
      genre: (m['genre'] ?? '').toString(),
      reads: (m['reads'] ?? '').toString(),
      totalChapters: i(m['totalChapters'], 0),
      chapter: i(m['chapter'], 1),
      savedAt: i(m['savedAt'], 0),
    );
  }
}

/// Lịch sử đọc local-first (Hive box `readingHistory`, key = bookId, tối đa 50).
class ReadingHistoryStore {
  ReadingHistoryStore(this._box);
  final Box _box;

  static const int maxEntries = 50;

  /// Upsert entry theo bookId; vượt [maxEntries] → xoá entry savedAt CŨ NHẤT.
  Future<void> record(ReadingHistoryEntry e) async {
    await _box.put(e.bookId, e.toMap());
    if (_box.length > maxEntries) {
      final all = entries();
      for (final old in all.skip(maxEntries)) {
        await _box.delete(old.bookId);
      }
    }
  }

  /// Toàn bộ entry, mới đọc nhất trước.
  List<ReadingHistoryEntry> entries() {
    final list = _box.values
        .whereType<Map>()
        .map(ReadingHistoryEntry.fromMap)
        .toList()
      ..sort((a, b) => b.savedAt.compareTo(a.savedAt));
    return list;
  }

  ReadingHistoryEntry? get(String bookId) {
    final m = _box.get(bookId);
    return m is Map ? ReadingHistoryEntry.fromMap(m) : null;
  }
}

/// Cắt chuỗi theo TỪ: quá [maxWords] → lấy maxWords từ đầu + '…' (dính từ cuối).
String truncateWords(String s, int maxWords) {
  final words = s.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.length <= maxWords) return words.join(' ');
  return '${words.take(maxWords).join(' ')}…';
}

/// Merge lịch sử BE vào local: remote MỚI HƠN thắng (cập nhật chapter/savedAt,
/// giữ synopsis/genre local); truyện chỉ có remote → entry mới (synopsis/genre
/// rỗng — card render bỏ dòng); local mới hơn giữ nguyên. Kết quả savedAt desc.
List<ReadingHistoryEntry> mergeHistory(List<ReadingHistoryEntry> local, List<RemoteHistoryEntry> remote) {
  final byId = {for (final e in local) e.bookId: e};
  for (final r in remote) {
    if (r.slug.isEmpty) continue;
    final cur = byId[r.slug];
    if (cur == null) {
      byId[r.slug] = ReadingHistoryEntry(
        bookId: r.slug, storyUuid: r.storyUuid, title: r.title, cover: r.cover,
        synopsis: '', genre: '', reads: r.reads,
        totalChapters: 0, chapter: r.chapterNumber, savedAt: r.lastListenedAtMs,
      );
    } else if (r.lastListenedAtMs > cur.savedAt) {
      byId[r.slug] = ReadingHistoryEntry(
        bookId: cur.bookId, storyUuid: cur.storyUuid ?? r.storyUuid, title: cur.title,
        cover: cur.cover, synopsis: cur.synopsis, genre: cur.genre,
        reads: cur.reads.isEmpty ? r.reads : cur.reads,
        totalChapters: cur.totalChapters, chapter: r.chapterNumber, savedAt: r.lastListenedAtMs,
      );
    }
  }
  final out = byId.values.toList()..sort((a, b) => b.savedAt.compareTo(a.savedAt));
  return out;
}
