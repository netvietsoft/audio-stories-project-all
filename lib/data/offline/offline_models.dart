/// Bản ghi 1 truyện trong sổ đăng ký offline (Hive box `downloads`).
class DownloadRecord {
  const DownloadRecord({
    required this.storyId,
    required this.slug,
    required this.title,
    required this.cover,
    required this.author,
    required this.language,
    required this.kind, // 'downloaded' | 'auto'
    required this.status, // 'pending'|'downloading'|'complete'|'failed'|'paused'
    required this.totalChapters,
    required this.savedChapters,
    required this.bytesText,
    required this.bytesAudio,
    required this.createdAt,
    required this.lastAccessAt,
  });

  final String storyId, slug, title, cover, author, language, kind, status;
  final int totalChapters, savedChapters, bytesText, bytesAudio, createdAt, lastAccessAt;

  int get totalBytes => bytesText + bytesAudio;

  DownloadRecord copyWith({
    String? kind,
    String? status,
    int? totalChapters,
    int? savedChapters,
    int? bytesText,
    int? bytesAudio,
    int? lastAccessAt,
  }) =>
      DownloadRecord(
        storyId: storyId,
        slug: slug,
        title: title,
        cover: cover,
        author: author,
        language: language,
        kind: kind ?? this.kind,
        status: status ?? this.status,
        totalChapters: totalChapters ?? this.totalChapters,
        savedChapters: savedChapters ?? this.savedChapters,
        bytesText: bytesText ?? this.bytesText,
        bytesAudio: bytesAudio ?? this.bytesAudio,
        createdAt: createdAt,
        lastAccessAt: lastAccessAt ?? this.lastAccessAt,
      );

  Map<String, dynamic> toMap() => {
        'storyId': storyId, 'slug': slug, 'title': title, 'cover': cover,
        'author': author, 'language': language, 'kind': kind, 'status': status,
        'totalChapters': totalChapters, 'savedChapters': savedChapters,
        'bytesText': bytesText, 'bytesAudio': bytesAudio,
        'createdAt': createdAt, 'lastAccessAt': lastAccessAt,
      };

  factory DownloadRecord.fromMap(Map map) {
    int i(dynamic v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0);
    String s(dynamic v) => (v ?? '').toString();
    return DownloadRecord(
      storyId: s(map['storyId']), slug: s(map['slug']), title: s(map['title']),
      cover: s(map['cover']), author: s(map['author']), language: s(map['language']),
      kind: s(map['kind']).isEmpty ? 'auto' : s(map['kind']),
      status: s(map['status']).isEmpty ? 'complete' : s(map['status']),
      totalChapters: i(map['totalChapters']), savedChapters: i(map['savedChapters']),
      bytesText: i(map['bytesText']), bytesAudio: i(map['bytesAudio']),
      createdAt: i(map['createdAt']), lastAccessAt: i(map['lastAccessAt']),
    );
  }
}

/// Nội dung text 1 chương (Hive box `chapters`).
class OfflineChapter {
  const OfflineChapter({
    required this.chapterId,
    required this.storyId,
    required this.n,
    required this.title,
    required this.content,
    required this.hasAudio,
    this.audioFile,
  });

  final String chapterId, storyId, title, content;
  final int n;
  final bool hasAudio;
  final String? audioFile;

  OfflineChapter copyWith({String? audioFile}) => OfflineChapter(
        chapterId: chapterId, storyId: storyId, n: n, title: title,
        content: content, hasAudio: hasAudio, audioFile: audioFile ?? this.audioFile,
      );

  Map<String, dynamic> toMap() => {
        'chapterId': chapterId, 'storyId': storyId, 'n': n, 'title': title,
        'content': content, 'hasAudio': hasAudio, 'audioFile': audioFile,
      };

  factory OfflineChapter.fromMap(Map map) => OfflineChapter(
        chapterId: (map['chapterId'] ?? '').toString(),
        storyId: (map['storyId'] ?? '').toString(),
        n: map['n'] is int ? map['n'] : int.tryParse('${map['n']}') ?? 0,
        title: (map['title'] ?? '').toString(),
        content: (map['content'] ?? '').toString(),
        hasAudio: map['hasAudio'] == true,
        audioFile: map['audioFile']?.toString(),
      );
}

/// Chi tiết truyện đủ để dựng BookDetail/Reader offline (Hive box `storyMeta`).
class OfflineStoryMeta {
  const OfflineStoryMeta({
    required this.storyId,
    required this.synopsis,
    required this.cover,
    required this.author,
    required this.subtitle,
    required this.status,
    required this.genre,
    required this.trope,
    required this.rating,
    required this.reads,
    required this.unlockPrice,
    required this.discountPercent,
    required this.totalChapters,
    required this.chapters,
  });

  final String storyId, synopsis, cover, author, subtitle, status, genre, trope, rating, reads;
  final int unlockPrice, discountPercent, totalChapters;
  final List<Map> chapters; // {chapterId,n,title,state,hasAudio}

  Map<String, dynamic> toMap() => {
        'storyId': storyId, 'synopsis': synopsis, 'cover': cover, 'author': author,
        'subtitle': subtitle, 'status': status, 'genre': genre, 'trope': trope,
        'rating': rating, 'reads': reads, 'unlockPrice': unlockPrice,
        'discountPercent': discountPercent, 'totalChapters': totalChapters,
        'chapters': chapters,
      };

  factory OfflineStoryMeta.fromMap(Map map) {
    int i(dynamic v) => v is int ? v : int.tryParse('${v ?? ''}') ?? 0;
    return OfflineStoryMeta(
      storyId: (map['storyId'] ?? '').toString(),
      synopsis: (map['synopsis'] ?? '').toString(),
      cover: (map['cover'] ?? '').toString(),
      author: (map['author'] ?? '').toString(),
      subtitle: (map['subtitle'] ?? '').toString(),
      status: (map['status'] ?? '').toString(),
      genre: (map['genre'] ?? '').toString(),
      trope: (map['trope'] ?? '').toString(),
      rating: (map['rating'] ?? '').toString(),
      reads: (map['reads'] ?? '').toString(),
      unlockPrice: i(map['unlockPrice']),
      discountPercent: i(map['discountPercent']),
      totalChapters: i(map['totalChapters']),
      chapters: (map['chapters'] as List? ?? const []).cast<Map>(),
    );
  }
}
