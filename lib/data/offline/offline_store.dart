import 'package:hive/hive.dart';

import 'file_store.dart';
import 'offline_models.dart';

/// Facade lưu trữ offline: metadata + text (Hive) và file audio (FileStore).
class OfflineStore {
  OfflineStore({
    required Box downloads,
    required Box chapters,
    required Box storyMeta,
    required FileStore files,
  })  : _downloads = downloads,
        _chapters = chapters,
        _storyMeta = storyMeta,
        _files = files;

  final Box _downloads, _chapters, _storyMeta;
  final FileStore _files;

  // ── downloads registry ──
  DownloadRecord? download(String storyId) {
    final m = _downloads.get(storyId);
    return m is Map ? DownloadRecord.fromMap(m) : null;
  }

  List<DownloadRecord> listDownloads() => _downloads.values
      .whereType<Map>()
      .map(DownloadRecord.fromMap)
      .toList();

  Future<void> upsertDownload(DownloadRecord r) =>
      _downloads.put(r.storyId, r.toMap());

  Future<void> touch(String storyId, int nowMs) async {
    final r = download(storyId);
    if (r != null) await upsertDownload(r.copyWith(lastAccessAt: nowMs));
  }

  int totalBytes(String kind) => listDownloads()
      .where((r) => r.kind == kind)
      .fold(0, (sum, r) => sum + r.totalBytes);

  // ── chapters ──
  bool hasChapter(String chapterId) => _chapters.containsKey(chapterId);

  OfflineChapter? readChapter(String chapterId) {
    final m = _chapters.get(chapterId);
    return m is Map ? OfflineChapter.fromMap(m) : null;
  }

  Future<void> saveChapter(OfflineChapter c) => _chapters.put(c.chapterId, c.toMap());

  // ── story meta ──
  OfflineStoryMeta? readStoryMeta(String storyId) {
    final m = _storyMeta.get(storyId);
    return m is Map ? OfflineStoryMeta.fromMap(m) : null;
  }

  Future<void> saveStoryMeta(OfflineStoryMeta m) => _storyMeta.put(m.storyId, m.toMap());

  // ── audio ──
  String? audioPath(String storyId, String chapterId) {
    final ch = readChapter(chapterId);
    if (ch?.audioFile == null) return null;
    return _files.audioPath(storyId, chapterId);
  }

  // ── delete ──
  Future<void> deleteStory(String storyId) async {
    final meta = readStoryMeta(storyId);
    final chapterIds = <String>[
      ...(_chapters.values.whereType<Map>().where((m) => m['storyId'] == storyId).map((m) => (m['chapterId'] ?? '').toString())),
      ...?meta?.chapters.map((c) => (c['chapterId'] ?? '').toString()),
    ];
    for (final id in chapterIds.toSet()) {
      await _chapters.delete(id);
    }
    await _storyMeta.delete(storyId);
    await _downloads.delete(storyId);
    await _files.deleteStory(storyId);
  }
}
