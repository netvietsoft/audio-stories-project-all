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
  /// Số chương tải song song tối đa khi tải cả truyện (cân bằng tốc độ vs số kết nối).
  static const int _downloadConcurrency = 4;

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
  final Set<String> _caching = {};
  final Set<String> _active = {}; // truyện đang tải (chống chạy trùng: tap lại / auto-resume)
  Map<String, DownloadProgress> get progress => Map.unmodifiable(_progress);

  void cancel(String storyId) => _cancelled.add(storyId);

  /// Tải/RESUME cả truyện. Hai pha:
  ///  1) TEXT trước — hiện tiến độ; xong là truyện ĐỌC được offline.
  ///  2) AUDIO tải NỀN (không hiện tiến độ) cho tới khi hết.
  /// Idempotent + resume: bỏ qua chương đã có text/audio local. Chống chạy trùng
  /// qua [_active] (tap lại hoặc auto-resume không tạo tiến trình chồng nhau).
  Future<void> downloadStory(String storyId) async {
    if (_active.contains(storyId)) return;
    _active.add(storyId);
    _cancelled.remove(storyId);
    try {
      final detail = await _stories.detailData(storyId);
      final total = detail.chapters.length;

      await _store.saveStoryMeta(OfflineStoryMeta(
          storyId: detail.storyId, synopsis: detail.synopsis, cover: detail.cover,
          author: detail.author, subtitle: detail.subtitle, status: detail.status,
          genre: detail.genre, trope: detail.trope, rating: detail.rating, reads: detail.reads,
          unlockPrice: detail.unlockPrice, discountPercent: detail.discountPercent,
          totalChapters: total, chapters: detail.chapters.map((c) => c.toMap()).toList()));

      // Resume: khởi từ record cũ nếu có (giữ bytes/kind/createdAt), không reset về 0.
      final prev = _store.download(storyId);
      var record = (prev ??
              DownloadRecord(
                  storyId: detail.storyId, slug: detail.slug, title: detail.title,
                  cover: detail.cover, author: detail.author, language: detail.language,
                  kind: 'downloaded', status: 'downloading', totalChapters: total,
                  savedChapters: 0, bytesText: 0, bytesAudio: 0,
                  createdAt: _now(), lastAccessAt: _now()))
          .copyWith(status: 'downloading', totalChapters: total);
      await _store.upsertDownload(record);

      bool hasText(ChapterMeta c) => (_store.readChapter(c.chapterId)?.content ?? '').isNotEmpty;
      bool hasAudioFile(ChapterMeta c) => _store.readChapter(c.chapterId)?.audioFile != null;

      // ── PHA 1: TEXT (hiện tiến độ) ── (đếm cả chương đã có sẵn khi resume)
      var textDone = detail.chapters.where(hasText).length;
      var bytesText = record.bytesText;
      _set(storyId, DownloadProgress(textDone, total, 'downloading'));

      final textTodo = detail.chapters.where((c) => !hasText(c)).toList();
      var ti = 0;
      Future<void> textWorker() async {
        while (true) {
          if (_cancelled.contains(storyId)) return;
          final i = ti++;
          if (i >= textTodo.length) return;
          final ch = textTodo[i];
          try {
            final text = await _stories.chapterText(ch.chapterId);
            final existing = _store.readChapter(ch.chapterId);
            await _store.saveChapter(OfflineChapter(
                chapterId: ch.chapterId, storyId: detail.storyId, n: ch.n, title: ch.title,
                content: text, hasAudio: ch.hasAudio, audioFile: existing?.audioFile));
            bytesText += text.length;
            textDone++;
          } catch (_) {/* chương lỗi → để lần resume sau */}
          record = record.copyWith(savedChapters: textDone, bytesText: bytesText);
          await _store.upsertDownload(record);
          _set(storyId, DownloadProgress(textDone, total, 'downloading'));
        }
      }
      await Future.wait(List.generate(_downloadConcurrency, (_) => textWorker()));

      if (_cancelled.contains(storyId)) {
        await _store.deleteStory(storyId);
        _progress.remove(storyId);
        notifyListeners();
        return;
      }

      // Text xong → ĐỌC được offline. Đánh dấu complete + ẩn tiến độ (progress='complete').
      record = record.copyWith(savedChapters: textDone, status: 'complete', lastAccessAt: _now());
      await _store.upsertDownload(record);
      _set(storyId, DownloadProgress(textDone, total, 'complete'));

      // ── PHA 2: AUDIO (tải NỀN, KHÔNG _set → không hiện tiến độ) ──
      final audioTodo = detail.chapters.where((c) => c.hasAudio && !hasAudioFile(c)).toList();
      var ai = 0;
      var bytesAudio = record.bytesAudio;
      Future<void> audioWorker() async {
        while (true) {
          if (_cancelled.contains(storyId)) return;
          final i = ai++;
          if (i >= audioTodo.length) return;
          final ch = audioTodo[i];
          try {
            final url = await _audio.chapterAudioUrl(ch.chapterId);
            if (url != null && url.isNotEmpty) {
              final n = await _download(url, detail.storyId, ch.chapterId);
              final existing = _store.readChapter(ch.chapterId);
              if (existing != null) {
                await _store.saveChapter(existing.copyWith(audioFile: '${ch.chapterId}.mp3'));
              }
              bytesAudio += n;
              record = record.copyWith(bytesAudio: bytesAudio, lastAccessAt: _now());
              await _store.upsertDownload(record); // cập nhật ngầm, không _set
            }
          } catch (_) {/* audio lỗi → lần sau resume tải nốt */}
        }
      }
      await Future.wait(List.generate(_downloadConcurrency, (_) => audioWorker()));
    } finally {
      _active.remove(storyId);
    }
  }

  void _set(String storyId, DownloadProgress p) {
    _progress[storyId] = p;
    notifyListeners();
  }

  /// Tự động cache audio khi nghe online: nếu chương chưa có file local → tải
  /// về + tạo/cập nhật record 'downloads' (kind mặc định 'auto', giữ nguyên
  /// nếu đã 'downloaded'), rồi enforce giới hạn dung lượng auto-cache. Nếu đã
  /// có sẵn → chỉ touch lastAccess (không tải lại).
  Future<void> autoCacheAudio({
    required String storyId, required String slug, required String title,
    required String cover, required String author, required String language,
    required String chapterId, required int n, required String chapterTitle,
    required String audioUrl, required int nowMs,
  }) async {
    if (_caching.contains(chapterId)) return;
    _caching.add(chapterId);
    try {
      final existing = _store.readChapter(chapterId);
      if (existing?.audioFile != null) { await _store.touch(storyId, nowMs); return; }
      final bytes = await _download(audioUrl, storyId, chapterId);
      await _store.saveChapter(OfflineChapter(
        chapterId: chapterId, storyId: storyId, n: n, title: chapterTitle,
        content: existing?.content ?? '', hasAudio: true, audioFile: '$chapterId.mp3'));
      final rec = _store.download(storyId);
      if (rec == null) {
        await _store.upsertDownload(DownloadRecord(
          storyId: storyId, slug: slug, title: title, cover: cover, author: author,
          language: language, kind: 'auto', status: 'complete', totalChapters: 0,
          savedChapters: 1, bytesText: 0, bytesAudio: bytes, createdAt: nowMs, lastAccessAt: nowMs));
      } else {
        // M4: không cho savedChapters vượt totalChapters (nếu đã biết totalChapters).
        final canIncrement = rec.savedChapters < rec.totalChapters || rec.totalChapters == 0;
        await _store.upsertDownload(rec.copyWith(
          savedChapters: canIncrement ? rec.savedChapters + 1 : rec.savedChapters,
          bytesAudio: rec.bytesAudio + bytes, lastAccessAt: nowMs));
      }
      await _store.enforceAutoCacheLimit(kMaxAutoCacheBytes);
    } catch (_) {
      // swallow: best-effort cache, không được làm crash luồng nghe.
    } finally {
      _caching.remove(chapterId);
    }
  }
}
