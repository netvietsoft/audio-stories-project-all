import 'package:flutter/foundation.dart';

import 'offline_store.dart';
import 'offline_models.dart';

/// Metadata 1 chương (đủ để tải + dựng meta). Do repository cung cấp.
class ChapterMeta {
  const ChapterMeta({required this.chapterId, required this.n, required this.title, required this.state, required this.hasAudio});
  final String chapterId, title, state;
  final int n;
  final bool hasAudio;
  Map<String, dynamic> toMap() => {'chapterId': chapterId, 'n': n, 'title': title, 'state': state, 'hasAudio': hasAudio};
}

/// Chi tiết truyện phẳng cho tải offline.
class StoryDetailData {
  const StoryDetailData({
    required this.storyId, required this.slug, required this.title, required this.cover,
    required this.author, required this.language, required this.synopsis, required this.subtitle,
    required this.status, required this.genre, required this.trope, required this.rating,
    required this.reads, required this.unlockPrice, required this.discountPercent, required this.chapters});
  final String storyId, slug, title, cover, author, language, synopsis, subtitle, status, genre, trope, rating, reads;
  final int unlockPrice, discountPercent;
  final List<ChapterMeta> chapters;
}

abstract class StoriesRepositoryLike {
  Future<StoryDetailData> detailData(String storyIdOrSlug);
  Future<String> chapterText(String chapterId);
}

abstract class AudioUrlResolver {
  Future<String?> chapterAudioUrl(String chapterId, {String? variantId});
}

/// Ghi file audio về đĩa; trả số byte. Bản thật dùng dio.download.
typedef FileDownloader = Future<int> Function(String url, String storyId, String chapterId);

class DownloadProgress {
  const DownloadProgress(this.done, this.total, this.status);
  final int done, total;
  final String status; // 'downloading'|'complete'|'failed'
  double get fraction => total == 0 ? 0 : done / total;
}

class DownloadManager extends ChangeNotifier {
  DownloadManager(this._stories, this._audio, this._store,
      {required FileDownloader downloader, int Function()? nowMs})
      : _download = downloader,
        _now = nowMs ?? (() => DateTime.now().millisecondsSinceEpoch);

  final StoriesRepositoryLike _stories;
  final AudioUrlResolver _audio;
  final OfflineStore _store;
  final FileDownloader _download;
  final int Function() _now;

  final Map<String, DownloadProgress> _progress = {};
  final Set<String> _cancelled = {};
  Map<String, DownloadProgress> get progress => Map.unmodifiable(_progress);

  void cancel(String storyId) => _cancelled.add(storyId);

  Future<void> downloadStory(String storyId) async {
    _cancelled.remove(storyId);
    final detail = await _stories.detailData(storyId);
    final total = detail.chapters.length;
    _set(storyId, DownloadProgress(0, total, 'downloading'));

    await _store.saveStoryMeta(OfflineStoryMeta(
        storyId: detail.storyId, synopsis: detail.synopsis, cover: detail.cover,
        author: detail.author, subtitle: detail.subtitle, status: detail.status,
        genre: detail.genre, trope: detail.trope, rating: detail.rating, reads: detail.reads,
        unlockPrice: detail.unlockPrice, discountPercent: detail.discountPercent,
        totalChapters: total, chapters: detail.chapters.map((c) => c.toMap()).toList()));

    var record = DownloadRecord(
        storyId: detail.storyId, slug: detail.slug, title: detail.title, cover: detail.cover,
        author: detail.author, language: detail.language, kind: 'downloaded',
        status: 'downloading', totalChapters: total, savedChapters: 0,
        bytesText: 0, bytesAudio: 0, createdAt: _now(), lastAccessAt: _now());
    await _store.upsertDownload(record);

    var saved = 0, bytesText = 0, bytesAudio = 0, failed = 0;
    for (final ch in detail.chapters) {
      if (_cancelled.contains(storyId)) {
        await _store.deleteStory(storyId);
        _progress.remove(storyId);
        notifyListeners();
        return;
      }
      try {
        final text = await _stories.chapterText(ch.chapterId);
        String? audioFile;
        if (ch.hasAudio) {
          final url = await _audio.chapterAudioUrl(ch.chapterId);
          if (url != null && url.isNotEmpty) {
            final n = await _download(url, detail.storyId, ch.chapterId);
            bytesAudio += n;
            audioFile = '${ch.chapterId}.mp3';
          }
        }
        bytesText += text.length;
        await _store.saveChapter(OfflineChapter(
            chapterId: ch.chapterId, storyId: detail.storyId, n: ch.n, title: ch.title,
            content: text, hasAudio: ch.hasAudio, audioFile: audioFile));
        saved++;
      } catch (_) {
        failed++;
      }
      record = record.copyWith(savedChapters: saved, bytesText: bytesText, bytesAudio: bytesAudio);
      await _store.upsertDownload(record);
      _set(storyId, DownloadProgress(saved, total, 'downloading'));
    }

    final status = failed == 0 ? 'complete' : 'failed';
    await _store.upsertDownload(record.copyWith(status: status, lastAccessAt: _now()));
    _set(storyId, DownloadProgress(saved, total, status));
  }

  void _set(String storyId, DownloadProgress p) {
    _progress[storyId] = p;
    notifyListeners();
  }
}
