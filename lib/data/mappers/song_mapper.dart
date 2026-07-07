import '../../models/models.dart';
import 'book_mapper.dart' show formatCount;

/// Map JSON music row từ backend (`/music`, `/music/:slug`) → [Song] (model UI).
///
/// Field BE: slug, title, artist, thumbnailUrl, audioUrl (mask nếu chưa entitled),
/// hlsUrl?, audioDuration, playCount.
/// Lưu ý: [Song.url] map từ `audioUrl` (MP3) để player phát qua UrlSource. HLS
/// (`hlsUrl`) để dành khi chuyển player sang just_audio (xem docs/06 §3.2).
abstract final class SongMapper {
  static Song fromJson(Map<String, dynamic> j) {
    return Song(
      cover: (j['thumbnailUrl'] ?? '').toString(),
      title: (j['title'] ?? '').toString(),
      author: (j['artist'] ?? '').toString(),
      reads: formatCount(j['playCount']),
      url: (j['audioUrl'] ?? '').toString(),
      hlsUrl: (j['hlsUrl'] ?? '').toString(),
    );
  }
}
