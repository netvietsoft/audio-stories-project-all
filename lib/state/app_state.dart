import 'dart:convert';

import 'package:just_audio/just_audio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/demo_data.dart';
import '../models/models.dart';

enum AppMode { novel, audio }

/// State toàn cục: theme sáng/tối, chế độ Novel/Audio, ngôn ngữ, coin/VIP, danh sách
/// yêu thích, chương đã mở khóa, Continue Reading, và PHÁT NHẠC THẬT qua just_audio
/// (asset assets/audio/, MP3 mạng có cache, hoặc HLS Cloudflare) — có hàng đợi next/prev.
class AppState extends ChangeNotifier {
  AppState() {
    // Vị trí phát đổi ~5 lần/giây → KHÔNG dùng notifyListeners (sẽ rebuild cả
    // cây). Dùng ValueNotifier để chỉ slider/đồng hồ lắng nghe (ValueListenable
    // Builder). Các thay đổi tần suất thấp (play/pause/đổi bài) mới notifyListeners.
    _player.positionStream.listen((p) => position.value = p);
    _player.durationStream.listen((d) => duration.value = d ?? Duration.zero);
    _player.bufferedPositionStream.listen((b) => buffered.value = b);
    _player.playerStateStream.listen((st) {
      if (st.playing != playing) {
        playing = st.playing;
        notifyListeners();
      }
      // Hết bài ở chế độ 1 nguồn (truyện) → reset. Playlist tự sang bài kế (just_audio).
      if (st.processingState == ProcessingState.completed && !_playlistMode) {
        playing = false;
        position.value = Duration.zero;
        notifyListeners();
      }
    });
    // Playlist tự chuyển bài → cập nhật metadata "now playing" theo index hiện tại.
    _player.currentIndexStream.listen((i) {
      if (_playlistMode && i != null && i >= 0 && i < _queue.length) {
        final s = _queue[i];
        nowPlayingTitle = s.title;
        nowPlayingAuthor = s.author;
        nowPlayingCover = s.cover;
        position.value = Duration.zero;
        notifyListeners();
      }
    });
  }

  // ── Lưu trữ bền (shared_preferences) ──
  // Chỉ persist state do NGƯỜI DÙNG đổi (theme, mode, coin, liked, unlocked).
  // streak/vip là cờ demo (sẽ do backend quyết định khi online) → không persist.
  // Token/secure data để dành flutter_secure_storage khi nối backend (xem docs/03 §6).
  SharedPreferences? _prefs;
  static const _kTheme = 'themeMode';
  static const _kMode = 'mode';
  static const _kCoins = 'coins';
  static const _kLiked = 'likedSongs';
  static const _kUnlocked = 'unlocked';
  static const _kContentLang = 'contentLang';
  static const _kUiLang = 'uiLang';
  static const _kLastRead = 'lastRead';

  ThemeMode themeMode = ThemeMode.light;
  AppMode mode = AppMode.novel;

  /// Ngôn ngữ NỘI DUNG (lọc truyện/thể loại qua param lang) — độc lập với UI.
  /// Mặc định 'en'. Đổi → các màn reload nội dung theo ngôn ngữ này.
  String contentLang = 'en';

  /// Ngôn ngữ HIỂN THỊ (dịch menu/tiêu đề) — lưu lựa chọn; bản dịch UI (i18n) làm sau.
  String uiLang = 'vi';

  /// Tab đang chọn ở AppShell (0 Home/1 Discover/2 Trending/3 Profile). Để màn
  /// đẩy (vd Reader) điều hướng về đúng tab qua bottom nav.
  int shellTab = 0;
  void setShellTab(int i) {
    if (shellTab == i) return;
    shellTab = i;
    notifyListeners();
  }
  int coins = 320;
  int streak = 6;
  bool vip = true;

  // ── Now playing + hàng đợi ──
  // Buffer ~30s TRƯỚC (giống web FE hls.js maxBufferLength=30) + start nhanh
  // (playback bắt đầu sau ~2s buffer) → chống chậm/lag, đặc biệt cho HLS Cloudflare.
  final AudioPlayer _player = AudioPlayer(
    audioLoadConfiguration: const AudioLoadConfiguration(
      androidLoadControl: AndroidLoadControl(
        minBufferDuration: Duration(seconds: 15),
        maxBufferDuration: Duration(seconds: 40),
        bufferForPlaybackDuration: Duration(seconds: 2),
        bufferForPlaybackAfterRebufferDuration: Duration(seconds: 4),
      ),
      darwinLoadControl: DarwinLoadControl(
        preferredForwardBufferDuration: Duration(seconds: 30),
      ),
    ),
  );

  /// Lấy access token hiện tại (do main wire = () => apiClient.accessToken) để gắn
  /// Bearer cho request HLS (key/segment) — chương/nhạc trả phí phát được.
  String? Function()? tokenProvider;
  String? nowPlayingTitle;
  String? nowPlayingAuthor;
  String? nowPlayingCover;
  bool playing = false;
  // Tần suất cao → ValueNotifier (xem constructor). UI dùng ValueListenableBuilder.
  final ValueNotifier<Duration> position = ValueNotifier(Duration.zero);
  final ValueNotifier<Duration> duration = ValueNotifier(Duration.zero);
  // Vị trí đã ĐỆM (buffered) — vẽ thanh buffer trên player.
  final ValueNotifier<Duration> buffered = ValueNotifier(Duration.zero);
  List<Song> _queue = const [];
  bool _playlistMode = false; // true = phát playlist (music, có preload bài kế)

  // ── Yêu thích + mở khóa ──
  final Set<String> _likedSongs = {};
  final Set<String> _unlocked = {}; // key "bookId:chapterNo"

  // ── Đọc gần nhất (Continue Reading — dữ liệu THẬT, ghi khi mở chương) ──
  String? lastReadBookId, lastReadTitle, lastReadCover, lastReadChapterTitle;
  int lastReadChapter = 0, lastReadTotal = 0;
  bool get hasLastRead => (lastReadBookId ?? '').isNotEmpty;

  /// Ghi lại chương đang đọc để Home hiện "Continue Reading" đúng thực tế.
  void setLastRead({
    required String bookId,
    required String title,
    required String cover,
    required int chapter,
    required String chapterTitle,
    required int total,
  }) {
    lastReadBookId = bookId;
    lastReadTitle = title;
    lastReadCover = cover;
    lastReadChapter = chapter;
    lastReadChapterTitle = chapterTitle;
    lastReadTotal = total;
    _prefs?.setString(_kLastRead, jsonEncode({
      'id': bookId, 'title': title, 'cover': cover,
      'ch': chapter, 'chTitle': chapterTitle, 'total': total,
    }));
    notifyListeners();
  }

  bool get isDark => themeMode == ThemeMode.dark;

  /// Nạp state đã lưu từ shared_preferences. GỌI MỘT LẦN trước runApp (xem
  /// main.dart) để theme/mode/coin đúng ngay frame đầu, không nháy giá trị mặc định.
  Future<void> init() async {
    final p = await SharedPreferences.getInstance();
    _prefs = p;
    themeMode = p.getString(_kTheme) == 'dark' ? ThemeMode.dark : ThemeMode.light;
    mode = p.getString(_kMode) == 'audio' ? AppMode.audio : AppMode.novel;
    contentLang = p.getString(_kContentLang) ?? contentLang;
    uiLang = p.getString(_kUiLang) ?? uiLang;
    coins = p.getInt(_kCoins) ?? coins;
    _likedSongs
      ..clear()
      ..addAll(p.getStringList(_kLiked) ?? const []);
    _unlocked
      ..clear()
      ..addAll(p.getStringList(_kUnlocked) ?? const []);
    final lr = p.getString(_kLastRead);
    if (lr != null && lr.isNotEmpty) {
      try {
        final m = jsonDecode(lr) as Map<String, dynamic>;
        lastReadBookId = m['id']?.toString();
        lastReadTitle = m['title']?.toString();
        lastReadCover = m['cover']?.toString();
        lastReadChapterTitle = m['chTitle']?.toString();
        lastReadChapter = (m['ch'] as num?)?.toInt() ?? 0;
        lastReadTotal = (m['total'] as num?)?.toInt() ?? 0;
      } catch (_) {/* bỏ qua bản ghi hỏng */}
    }
    notifyListeners();
  }

  void toggleTheme() {
    themeMode = isDark ? ThemeMode.light : ThemeMode.dark;
    _prefs?.setString(_kTheme, isDark ? 'dark' : 'light');
    notifyListeners();
  }

  void setMode(AppMode m) {
    if (mode == m) return;
    mode = m;
    _prefs?.setString(_kMode, m == AppMode.audio ? 'audio' : 'novel');
    notifyListeners();
  }

  /// Đổi ngôn ngữ NỘI DUNG → màn watch contentLang sẽ reload truyện/thể loại.
  void setContentLang(String lang) {
    if (contentLang == lang) return;
    contentLang = lang;
    _prefs?.setString(_kContentLang, lang);
    notifyListeners();
  }

  /// Đổi ngôn ngữ HIỂN THỊ (lưu lựa chọn; áp dụng dịch khi có i18n).
  void setUiLang(String lang) {
    if (uiLang == lang) return;
    uiLang = lang;
    _prefs?.setString(_kUiLang, lang);
    notifyListeners();
  }

  // ── Coin ──
  bool spendCoins(int n) {
    if (coins < n) return false;
    coins -= n;
    _prefs?.setInt(_kCoins, coins);
    notifyListeners();
    return true;
  }

  void addCoins(int n) {
    coins += n;
    _prefs?.setInt(_kCoins, coins);
    notifyListeners();
  }

  // ── Mở khóa chương ──
  bool isUnlocked(String bookId, int n) => _unlocked.contains('$bookId:$n');
  void unlockChapter(String bookId, int n) {
    _unlocked.add('$bookId:$n');
    _prefs?.setStringList(_kUnlocked, _unlocked.toList());
    notifyListeners();
  }

  // ── Like bài hát ──
  bool isLiked(String title) => _likedSongs.contains(title);
  void toggleLike(String title) {
    if (!_likedSongs.add(title)) _likedSongs.remove(title);
    _prefs?.setStringList(_kLiked, _likedSongs.toList());
    notifyListeners();
  }

  List<Song> get likedSongs => Demo.songs.where((s) => _likedSongs.contains(s.title)).toList();

  /// Nguồn audio:
  /// - HLS (.m3u8 trên Cloudflare) → AudioSource.uri (ExoPlayer stream + buffer 30s;
  ///   gắn Bearer để key/segment trả phí qua được).
  /// - MP3 mạng → LockCachingAudioSource (tải dần + cache đĩa → phát nhanh, nghe lại tức thì).
  /// - path assets/ → AudioSource.asset.
  AudioSource _sourceFor(String url) {
    if (url.contains('.m3u8')) {
      final token = tokenProvider?.call();
      return AudioSource.uri(
        Uri.parse(url),
        headers: (token != null && token.isNotEmpty) ? {'Authorization': 'Bearer $token'} : null,
      );
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // ignore: experimental_member_use — cache MP3 xuống đĩa (nghe lại không tải lại).
      return LockCachingAudioSource(Uri.parse(url));
    }
    return AudioSource.asset('assets/$url');
  }

  /// Chọn URL phát cho 1 bài: ưu tiên HLS (m3u8 Cloudflare) nếu có.
  String _playableUrl(Song s) => s.hlsUrl.isNotEmpty ? s.hlsUrl : s.url;

  /// Phát một danh sách nhạc dưới dạng PLAYLIST → just_audio TỰ PRELOAD bài kế
  /// (buffer sẵn) nên next() gần như tức thì. Chỉ nhận bài có url phát được.
  Future<void> playSong(Song s, {List<Song>? queue}) async {
    final all = queue ?? Demo.songs;
    _queue = all.where((x) => _playableUrl(x).isNotEmpty).toList();
    if (_queue.isEmpty) return;
    var idx = _queue.indexWhere((x) => x.title == s.title);
    if (idx < 0) idx = 0;
    _playlistMode = true;
    final cur = _queue[idx];
    nowPlayingTitle = cur.title;
    nowPlayingAuthor = cur.author;
    nowPlayingCover = cur.cover;
    position.value = Duration.zero;
    notifyListeners();
    try {
      final playlist = ConcatenatingAudioSource(
        children: _queue.map((x) => _sourceFor(_playableUrl(x))).toList(),
      );
      await _player.setAudioSource(playlist, initialIndex: idx, initialPosition: Duration.zero);
      _player.play();
      playing = true;
    } catch (_) {
      playing = false;
    }
    notifyListeners();
  }

  bool get hasQueue => _playlistMode && _queue.length > 1;

  Future<void> next() async {
    if (!hasQueue) return;
    if (_player.hasNext) {
      await _player.seekToNext();
    } else {
      await _player.seek(Duration.zero, index: 0); // ở bài cuối → quay về bài đầu
    }
  }

  Future<void> prev() async {
    // Đã phát >3s → tua về đầu bài; ngược lại lùi bài.
    if (position.value.inSeconds > 3) {
      await seek(Duration.zero);
      return;
    }
    if (!hasQueue) return;
    if (_player.hasPrevious) {
      await _player.seekToPrevious();
    } else {
      await _player.seek(Duration.zero, index: _queue.length - 1); // ở bài đầu → sang bài cuối
    }
  }

  /// Phát MỘT nguồn đơn (chương truyện / audiobook). [url] là URL mạng hoặc path
  /// trong assets/. Không có url → chỉ set metadata.
  Future<void> play(String title, String author, String cover, [String? url]) async {
    _playlistMode = false;
    _queue = const [];
    nowPlayingTitle = title;
    nowPlayingAuthor = author;
    nowPlayingCover = cover;
    position.value = Duration.zero;
    notifyListeners();
    if (url == null || url.isEmpty) return;
    try {
      await _player.setAudioSource(_sourceFor(url));
      _player.play();
      playing = true;
    } catch (_) {
      playing = false;
    }
    notifyListeners();
  }

  /// Phát audiobook ĐÃ TẢI OFFLINE (file trên đĩa) — tái dùng luồng phát 1 nguồn
  /// giống [play], chỉ khác nguồn là file:// (Uri.file) thay vì URL mạng/HLS.
  Future<void> playLocalAudiobook(Book book, Chapter ch, String filePath) async {
    _playlistMode = false;
    _queue = const [];
    nowPlayingTitle = '${book.title} • Ch.${ch.n}';
    nowPlayingAuthor = book.author;
    nowPlayingCover = book.cover;
    position.value = Duration.zero;
    notifyListeners();
    try {
      await _player.setAudioSource(AudioSource.uri(Uri.file(filePath)));
      _player.play();
      playing = true;
    } catch (_) {
      playing = false;
    }
    notifyListeners();
  }

  Future<void> togglePlay() async {
    if (nowPlayingTitle == null) return;
    if (playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
  }

  Future<void> seek(Duration to) => _player.seek(to);

  Future<void> stop() async {
    await _player.stop();
    nowPlayingTitle = null;
    playing = false;
    position.value = Duration.zero;
    _queue = const [];
    _playlistMode = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _player.dispose();
    position.dispose();
    duration.dispose();
    buffered.dispose();
    super.dispose();
  }
}
