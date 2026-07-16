import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:share_plus/share_plus.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../api/api_exception.dart';
import '../../data/comments/paragraph_anchor.dart';
import '../../data/reader/reader_store.dart';
import '../../data/reader/reader_models.dart';
import '../../data/repositories/audio_repository.dart';
import '../../data/repositories/comments_repository.dart';
import '../../data/repositories/stories_repository.dart';
import '../../data/share_links.dart';
import '../../l10n/l10n_ext.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';
import '../../widgets/sheets.dart';
import 'widgets/comments_sheet.dart';

/// Gộp ngắt dòng CỨNG trong 1 đoạn thành khoảng trắng — content một số truyện
/// import từ nguồn PDF/txt bị wrap ~70 cột (`\n` đơn giữa câu) làm reader xuống
/// dòng sớm. Thay 1:1 (GIỮ NGUYÊN độ dài) để offset `cs/ce` của read-along không lệch.
String flattenHardBreaks(String para) => para.replaceAll('\n', ' ');

/// Màn ĐỌC truyện (thiết kế readding/set trang/nghe truyện/cuoi trang).
/// Top bar tuỳ chỉnh (không phải AppBar) trượt ẩn/hiện: nghe / bookmark / Aa (settings chi tiết) / danh sách chương.
/// Menu dưới 4 tab tự ẩn khi cuộn xuống, hiện khi cuộn lên; thanh read-along khi nghe.
class ReaderScreen extends StatefulWidget {
  const ReaderScreen({super.key, required this.bookId, this.initialChapter});
  final String bookId;
  final int? initialChapter;

  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> {
  late int _chapter = widget.initialChapter ?? 1;
  bool _error = false; // tải chi tiết thất bại
  final _scroll = ScrollController();
  bool _chromeVisible = true; // menu dưới hiện/ẩn theo hướng cuộn
  Timer? _saveDebounce;
  bool _resumed = false;
  double? _pendingJumpOffset;
  final ValueNotifier<double> _progress = ValueNotifier(0);

  // ── tuỳ chỉnh đọc (set trang.png) ──
  int _bg = 0; // 0 Cream · 1 White · 2 Sepia · 3 Dark · 4 Custom (màu ở _customBg)
  Color? _textColor; // luôn non-null sau initState (resolveLegacySettings); mặc định Đen
  Color? _customBg;  // nền custom (bg == 4); null khi user chưa từng chọn
  double _fontSize = 18;
  String _font = 'serif'; // serif · sans · dyslexia
  double _lineHeight = 1.6;
  String _margin = 'medium'; // narrow · medium · wide
  double _brightness = 1.0;

  // ── dữ liệu ──
  late final StoriesRepository _repo;
  late final ReaderStore _reader;
  StoryDetail? _detail;
  String _content = '';
  bool _loading = true;
  bool _loadingContent = false;

  // ── read-along ──
  bool _readAlong = false;
  List<TimingCue> _cues = const [];
  final ValueNotifier<int> _activeCue = ValueNotifier(-1);
  final Map<int, GlobalKey> _paraKeys = {};
  bool _playingThis = false; // audio của ĐÚNG chương đang hiển thị có đang phát không

  String _chapterId = ''; // id chương đang hiển thị (cho comments/gift)
  List<String> _paras = const []; // đoạn đã trim+flatten — dùng chung render & comments
  Map<int, List<ChapterComment>> _paraComments = {}; // index đoạn → comments (rỗng khi offline/lỗi)

  static const _bgs = [Color(0xFFFBF3E3), Color(0xFFFFFFFF), Color(0xFFF4E7CC), Color(0xFF15110C), Color(0xFF000000)];
  static const _bgLabels = ['Cream', 'White', 'Sepia', 'Dark', 'OLED'];
  static const _palette = [
    Color(0xFF000000), Color(0xFF5B4F3A), Color(0xFF8A5A2B), Color(0xFFC2683A),
    Color(0xFF4E6E58), Color(0xFF35506E), Color(0xFF7A5470), Color(0xFF9A3B4A),
  ];
  @override
  void initState() {
    super.initState();
    _repo = context.read<StoriesRepository>();
    _reader = context.read<ReaderStore>();
    final s = resolveLegacySettings(_reader.readSettings());
    _bg = s.bg;
    _customBg = s.customBg == null ? null : Color(s.customBg!);
    _textColor = Color(s.textColor!); // resolve đảm bảo non-null
    _fontSize = s.fontSize;
    _font = s.font;
    _lineHeight = s.lineHeight;
    _margin = s.margin;
    _readAlong = _reader.readReadAlong();
    final b = _reader.readBrightness();
    if (b >= 0) {
      _brightness = b;
      ScreenBrightness().setApplicationScreenBrightness(b).catchError((_) {});
    }
    _scroll.addListener(_onScroll);
    _init();
    WakelockPlus.enable().catchError((_) {});
  }

  @override
  void dispose() {
    WakelockPlus.disable().catchError((_) {});
    ScreenBrightness().resetApplicationScreenBrightness().catchError((_) {});
    _saveDebounce?.cancel();
    if (_scroll.hasClients) _reader.savePosition(widget.bookId, _chapter, _scroll.offset);
    _scroll.dispose();
    _progress.dispose();
    _activeCue.dispose();
    super.dispose();
  }

  Future<void> _applyBrightness(double v) async {
    _brightness = v;
    try { await ScreenBrightness().setApplicationScreenBrightness(v); } catch (_) {}
    _reader.saveBrightness(v);
  }

  // Cuộn xuống (đọc tiếp) → ẩn menu; cuộn lên → hiện.
  void _onScroll() {
    if (_scroll.hasClients && _scroll.position.maxScrollExtent > 0) {
      _progress.value = (_scroll.offset / _scroll.position.maxScrollExtent).clamp(0.0, 1.0);
    }
    final dir = _scroll.position.userScrollDirection;
    if (dir == ScrollDirection.reverse && _chromeVisible) {
      setState(() => _chromeVisible = false);
    } else if (dir == ScrollDirection.forward && !_chromeVisible) {
      setState(() => _chromeVisible = true);
    }
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(seconds: 1), () {
      if (_scroll.hasClients) _reader.savePosition(widget.bookId, _chapter, _scroll.offset);
    });
  }

  Future<void> _init() async {
    try {
      final detail = await _repo.detail(widget.bookId);
      if (!mounted) return;
      final nums = detail.chapters.map((c) => c.n).toList();
      if (nums.isNotEmpty && !nums.contains(_chapter)) _chapter = nums.first;
      if (widget.initialChapter == null) {
        final saved = _reader.position(widget.bookId);
        if (saved != null && detail.chapters.any((c) => c.n == saved.chapter)) {
          _chapter = saved.chapter;
        }
      }
      setState(() {
        _detail = detail;
        _loading = false;
      });
      await _loadContent();
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = true; });
    }
  }

  Future<void> _loadContent() async {
    if (!mounted) return;
    final chapters = _detail?.chapters ?? const [];
    final ch = chapters.firstWhere((c) => c.n == _chapter,
        orElse: () => chapters.isNotEmpty ? chapters.first : const Chapter(n: 1, title: '', state: ChapterState.free));
    final app = context.read<AppState>();
    final locked = _locked(app, ch);

    if (!locked) _recordLastRead(ch); // ghi "đọc gần nhất" THẬT cho Home

    if (ch.id.isNotEmpty && !locked) {
      setState(() => _loadingContent = true);
      try {
        final c = await _repo.chapterContent(ch.id);
        if (!mounted) return;
        _setContent(c.content.trim());
        _cues = c.cues;
        _chapterId = ch.id;
        _paras = _content.split(RegExp(r'\n\s*\n')).map((p) => flattenHardBreaks(p.trim())).where((p) => p.isNotEmpty).toList();
        _loadParaComments(); // online-only, lỗi → bubble ẩn
      } catch (_) {
        if (!mounted) return;
        _setContent('');
      }
      if (mounted) setState(() => _loadingContent = false);
    } else {
      _setContent('');
    }
    if (!_resumed && !locked) {
      _resumed = true;
      final saved = _reader.position(widget.bookId);
      if (saved != null && saved.chapter == _chapter && saved.offset > 0) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scroll.hasClients) {
            _scroll.jumpTo(saved.offset.clamp(0, _scroll.position.maxScrollExtent));
          }
        });
      }
    }
    if (_pendingJumpOffset != null) {
      final target = _pendingJumpOffset!;
      _pendingJumpOffset = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.jumpTo(target.clamp(0, _scroll.position.maxScrollExtent));
      });
    }
  }

  void _setContent(String text) => setState(() => _content = text);

  /// Nạp comment cấp đoạn của chương (online). Lỗi/offline → map rỗng (bubble ẩn).
  Future<void> _loadParaComments() async {
    final chapterId = _chapterId;
    try {
      final all = await context.read<CommentsRepository>().paragraphAll(chapterId);
      if (!mounted || chapterId != _chapterId) return; // đã sang chương khác
      setState(() => _paraComments = matchCommentsToParagraphs(all, _paras));
    } catch (_) {
      if (mounted && chapterId == _chapterId) setState(() => _paraComments = {});
    }
  }

  /// Lưu chương đang đọc để Home hiện Continue Reading đúng thực tế.
  void _recordLastRead(Chapter ch) {
    final b = _detail?.book;
    if (b == null) return;
    context.read<AppState>().setLastRead(
          bookId: b.id,
          title: b.title,
          cover: b.cover,
          chapter: ch.n,
          chapterTitle: ch.title,
          total: b.chapters,
        );
  }

  /// Title dùng cho AppState.play — PHẢI khớp với _playingThis ở build() để xác định
  /// đúng "đang phát audio của CHƯƠNG này" (không chỉ đúng sách).
  String _audioTitle(Book book, Chapter ch) => '${book.title} • Ch.${ch.n}';

  Future<void> _playChapterAudio(Book book, Chapter ch) async {
    final app = context.read<AppState>();
    if (ch.hlsUrl.isNotEmpty) {
      app.play(_audioTitle(book, ch), book.author, book.cover, ch.hlsUrl);
      return;
    }
    if (ch.id.isNotEmpty) {
      try {
        final url = await context.read<AudioRepository>().chapterAudioUrl(ch.id);
        if (!mounted) return;
        if (url != null && url.isNotEmpty) {
          app.play(_audioTitle(book, ch), book.author, book.cover, url);
          return;
        }
      } on ApiException catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Không phát được: ${e.message}')));
        return;
      } catch (_) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không phát được audio')));
        return;
      }
    }
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Chương chưa có audio')));
  }

  void _goChapter(int n, List<Chapter> chapters) {
    if (!chapters.any((c) => c.n == n)) { _pendingJumpOffset = null; return; }
    setState(() {
      _chapter = n;
      _chromeVisible = true;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
    _progress.value = 0;
    _activeCue.value = -1;
    _paraKeys.clear();
    _paraComments = {};
    _paras = const [];
    _loadContent();
  }

  bool _locked(AppState app, Chapter c) =>
      (c.state == ChapterState.coin || c.state == ChapterState.vip) && !app.isUnlocked(widget.bookId, c.n);

  TextStyle _bodyStyle(Color ink) {
    if (_font == 'serif') return AppType.serif(size: _fontSize, color: ink, height: _lineHeight);
    // sans / dyslexia (chưa bundle OpenDyslexic → dùng sans Figtree)
    return AppType.body(size: _fontSize, color: ink).copyWith(height: _lineHeight);
  }

  double get _marginH => _margin == 'narrow' ? 14 : (_margin == 'wide' ? 34 : 20);

  String _snippetAtOffset() {
    final paras = _content.split(RegExp(r'\n\s*\n')).map((p) => flattenHardBreaks(p.trim())).where((p) => p.isNotEmpty).toList();
    if (paras.isEmpty) return '';
    // ước lượng đoạn theo tỉ lệ cuộn (đủ để nhận diện trong danh sách)
    final frac = (_scroll.hasClients && _scroll.position.maxScrollExtent > 0)
        ? (_scroll.offset / _scroll.position.maxScrollExtent).clamp(0.0, 1.0)
        : 0.0;
    final idx = (frac * (paras.length - 1)).round().clamp(0, paras.length - 1);
    final s = paras[idx];
    return s.length <= 60 ? s : '${s.substring(0, 60)}…';
  }

  void _toggleBookmark() {
    final list = _reader.bookmarks(widget.bookId);
    // Nếu đang ~trùng một bookmark (cùng chương, |offset| < 40) → xoá; ngược lại thêm.
    final off = _scroll.hasClients ? _scroll.offset : 0.0;
    final near = list.where((b) => b.chapter == _chapter && (b.offset - off).abs() < 40).toList();
    if (near.isNotEmpty) {
      _reader.removeBookmark(widget.bookId, near.first.savedAt);
    } else {
      _reader.addBookmark(widget.bookId, Bookmark(
        chapter: _chapter, offset: off, snippet: _snippetAtOffset(),
        savedAt: DateTime.now().millisecondsSinceEpoch));
    }
    setState(() {});
  }

  bool get _isBookmarkedHere {
    final off = _scroll.hasClients ? _scroll.offset : 0.0;
    return _reader.bookmarks(widget.bookId).any((b) => b.chapter == _chapter && (b.offset - off).abs() < 40);
  }

  void _persistSettings() {
    _reader.saveSettings(ReaderSettings(
      bg: _bg,
      customBg: _customBg?.toARGB32(),
      textColor: _textColor?.toARGB32(),
      fontSize: _fontSize,
      font: _font,
      lineHeight: _lineHeight,
      margin: _margin,
    ));
  }

  bool get _readAlongActive => _readAlong && _cues.isNotEmpty && _playingThis;

  void _syncActiveCue(AppState app) {
    if (!_readAlongActive) {
      if (_activeCue.value != -1) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _activeCue.value = -1;
        });
      }
      return;
    }
    final idx = activeCueIndex(_cues, app.position.value.inMilliseconds) ?? -1;
    if (idx != _activeCue.value) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _activeCue.value = idx;
        // auto-scroll tới đoạn của cue (nếu có key)
        if (idx >= 0 && _cues[idx].paraIndex >= 0) _scrollToPara(_cues[idx].paraIndex);
      });
    }
  }

  void _scrollToPara(int i) {
    final key = _paraKeys[i];
    final ctx = key?.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(ctx, alignment: 0.3, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bg = _bg == 4 ? (_customBg ?? const Color(kOledBlackBg)) : _bgs[_bg];
    final ink = _textColor ?? const Color(kDefaultTextColor);
    if (_error) {
      return Scaffold(
        backgroundColor: bg,
        appBar: AppBar(backgroundColor: bg, elevation: 0, iconTheme: IconThemeData(color: ink)),
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.cloud_off, size: 44, color: ink.withValues(alpha: 0.5)),
            const SizedBox(height: 10),
            Text('Không tải được truyện', style: AppType.item(size: 14, color: ink)),
          ]),
        ),
      );
    }
    if (_loading || _detail == null) {
      return Scaffold(
        backgroundColor: bg,
        body: const Center(child: CircularProgressIndicator(color: AppPalette.terracotta)),
      );
    }
    final app = context.watch<AppState>();
    final book = _detail!.book;
    final chapters = _detail!.chapters;
    final ch = chapters.firstWhere((c) => c.n == _chapter, orElse: () => chapters.first);
    final locked = _locked(app, ch);
    // Chỉ true khi audio ĐANG PHÁT là của ĐÚNG chương đang hiển thị (không chỉ đúng sách).
    final playingThis = app.nowPlayingTitle == _audioTitle(book, ch);
    _playingThis = playingThis;

    return Scaffold(
      backgroundColor: bg,
      body: Stack(
        children: [
          locked
              ? _lockedPanel(context, book, ch, ink)
              : GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: () => setState(() => _chromeVisible = !_chromeVisible),
                  child: ListView(
                    controller: _scroll,
                    padding: EdgeInsets.fromLTRB(_marginH, MediaQuery.paddingOf(context).top + 60, _marginH, 120),
                    children: [
                      Center(child: Text(ch.title, textAlign: TextAlign.center, style: AppType.hero(size: 26, color: ink))),
                      const SizedBox(height: Gap.xl),
                      _body(ink),
                      const SizedBox(height: Gap.xl),
                      _endOfChapter(context, book, ink, chapters),
                    ],
                  ),
                ),
          // Nghe app.position khi đang phát chương này → đồng bộ activeCue (không setState).
          if (playingThis)
            ValueListenableBuilder<Duration>(
              valueListenable: app.position,
              builder: (_, __, ___) {
                _syncActiveCue(app);
                return const SizedBox.shrink();
              },
            ),
          // Menu dưới auto-hide + thanh read-along (khi nghe).
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: AnimatedSlide(
              duration: const Duration(milliseconds: 220),
              offset: _chromeVisible ? Offset.zero : const Offset(0, 1),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                if (playingThis) _readAlongBar(context, app, book, bg, ink),
                _readerNav(context, bg, ink),
              ]),
            ),
          ),
          // Top bar trượt (thay AppBar) — vẫn hiện khi khoá chương.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: AnimatedSlide(
              duration: const Duration(milliseconds: 220),
              offset: _chromeVisible ? Offset.zero : const Offset(0, -1),
              child: _topBar(context, book, ch, chapters, locked, bg, ink),
            ),
          ),
        ],
      ),
    );
  }

  Widget _topBar(BuildContext context, Book book, Chapter ch, List<Chapter> chapters, bool locked, Color bg, Color ink) {
    return Container(
      color: bg,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: 52,
          child: Row(children: [
            IconButton(icon: Icon(Icons.arrow_back, color: ink), onPressed: () => context.pop()),
            Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(book.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 14, color: ink)),
              Text('Ch ${ch.n}/${chapters.length} · ${ch.title}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.meta(size: 11, color: ink.withValues(alpha: 0.6))),
            ])),
            if (chapters.any((c) => c.hasAudio))
              IconButton(tooltip: 'Nghe', icon: Icon(Icons.headphones_outlined, color: ink), onPressed: locked ? null : () => _playChapterAudio(book, ch)),
            IconButton(tooltip: 'Đánh dấu', icon: Icon(_isBookmarkedHere ? Icons.bookmark : Icons.bookmark_border, color: ink), onPressed: _toggleBookmark),
            IconButton(tooltip: 'Tuỳ chỉnh đọc', icon: Text('Aa', style: AppType.serif(size: 18, w: FontWeight.w700, color: ink)), onPressed: _openSettings),
            IconButton(tooltip: 'Danh sách chương', icon: Icon(Icons.menu, color: ink), onPressed: () => _openChapterList(chapters)),
          ]),
        ),
      ),
    );
  }

  Widget _body(Color ink) {
    if (_loadingContent) {
      return Padding(padding: const EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: ink.withValues(alpha: 0.5))));
    }
    final base = _bodyStyle(ink);
    final paras = _paras;
    if (paras.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 48),
        child: Center(child: Text('Nội dung chương đang được cập nhật', style: base.copyWith(fontSize: 15))),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < paras.length; i++) ...[
          // Long-press đoạn → viết/xem comment đoạn (không ảnh hưởng tap-center toggle chrome).
          GestureDetector(
            onLongPress: () => _openParaComments(i),
            child: _paragraph(i, paras[i], base, ink, _paraKey(i)),
          ),
          if (_paraComments[i]?.isNotEmpty == true)
            Align(
              alignment: Alignment.centerRight,
              child: GestureDetector(
                onTap: () => _openParaComments(i),
                child: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.mode_comment_outlined, size: 14, color: ink.withValues(alpha: 0.45)),
                    const SizedBox(width: 3),
                    Text('${_paraComments[i]!.length}', style: AppType.meta(size: 11, color: ink.withValues(alpha: 0.45))),
                  ]),
                ),
              ),
            ),
          if (i < paras.length - 1) const SizedBox(height: Gap.lg),
        ],
      ],
    );
  }

  void _openParaComments(int i) {
    if (_chapterId.isEmpty || i >= _paras.length) return;
    showChapterCommentsSheet(
      context,
      chapterId: _chapterId,
      scope: 'paragraph',
      paragraphIndex: i,
      paragraphAnchor: makeAnchor(_paras[i]),
      initial: _paraComments[i] ?? const [],
      onCreated: (c) => setState(() => (_paraComments[i] ??= []).add(c)),
    );
  }

  GlobalKey _paraKey(int i) => _paraKeys.putIfAbsent(i, () => GlobalKey());

  Widget _paragraph(int i, String text, TextStyle base, Color ink, GlobalKey? key) {
    return ValueListenableBuilder<int>(
      valueListenable: _activeCue,
      builder: (_, active, __) {
        final cue = (active >= 0 && active < _cues.length) ? _cues[active] : null;
        if (!_readAlongActive || cue == null || cue.paraIndex != i || cue.paraIndex < 0) {
          return Text(text, key: key, style: base);
        }
        final cs = cue.charStart.clamp(0, text.length);
        final ce = cue.charEnd.clamp(cs, text.length);
        return Text.rich(
          key: key,
          TextSpan(style: base, children: [
            TextSpan(text: text.substring(0, cs)),
            TextSpan(text: text.substring(cs, ce), style: base.copyWith(
              backgroundColor: AppPalette.terracotta.withValues(alpha: 0.25),
              fontWeight: FontWeight.w600)),
            TextSpan(text: text.substring(ce)),
          ]),
        );
      },
    );
  }

  // Menu dưới 4 tab (thiết kế readding.png) — tap điều hướng về AppShell đúng tab.
  Widget _readerNav(BuildContext context, Color bg, Color ink) {
    final items = [
      (Icons.home_outlined, context.l10n.navHome, 0),
      (Icons.auto_awesome_outlined, context.l10n.navDiscover, 1),
      (Icons.north_east, context.l10n.navTrending, 2),
      (Icons.pie_chart_outline, context.l10n.navProfile, 3),
    ];
    return Container(
      decoration: BoxDecoration(color: bg, border: Border(top: BorderSide(color: ink.withValues(alpha: 0.12)))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ValueListenableBuilder<double>(
          valueListenable: _progress,
          builder: (_, v, __) => LinearProgressIndicator(
            value: v, minHeight: 2.5,
            backgroundColor: ink.withValues(alpha: 0.10), color: AppPalette.terracotta),
        ),
        SafeArea(
          top: false,
          child: SizedBox(
            height: 60,
            child: Row(children: [
              for (final it in items)
                Expanded(
                  child: InkWell(
                    onTap: () {
                      context.read<AppState>().setShellTab(it.$3);
                      context.go('/home');
                    },
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(it.$1, size: 21, color: ink.withValues(alpha: 0.75)),
                      const SizedBox(height: 3),
                      Text(it.$2, style: AppType.tabLabel(color: ink.withValues(alpha: 0.75))),
                    ]),
                  ),
                ),
            ]),
          ),
        ),
      ]),
    );
  }

  // Thanh read-along/audio (thiết kế nghe truyện.png).
  Widget _readAlongBar(BuildContext context, AppState app, Book book, Color bg, Color ink) {
    return Container(
      color: bg,
      padding: const EdgeInsets.fromLTRB(Gap.md, 8, Gap.sm, 8),
      child: Row(children: [
        ClipRRect(
          borderRadius: rounded(8),
          child: SizedBox(width: 40, height: 40, child: (book.cover.isNotEmpty) ? Image.asset(book.cover, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppPalette.plum)) : Container(color: AppPalette.plum)),
        ),
        const SizedBox(width: Gap.sm),
        Expanded(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Read-along · Ch. $_chapter · ${book.author}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.item(size: 12.5, color: ink)),
            const SizedBox(height: 4),
            ValueListenableBuilder<Duration>(
              valueListenable: app.position,
              builder: (_, pos, __) {
                final durMs = app.duration.value.inMilliseconds;
                final v = durMs > 0 ? (pos.inMilliseconds / durMs).clamp(0.0, 1.0) : 0.0;
                return ClipRRect(
                  borderRadius: rounded(3),
                  child: LinearProgressIndicator(value: v.toDouble(), minHeight: 4, backgroundColor: ink.withValues(alpha: 0.15), color: AppPalette.terracotta),
                );
              },
            ),
          ]),
        ),
        const SizedBox(width: Gap.sm),
        GestureDetector(
          onTap: app.togglePlay,
          child: Container(
            width: 40, height: 40,
            decoration: const BoxDecoration(color: AppPalette.terracotta, shape: BoxShape.circle),
            child: Icon(app.playing ? Icons.pause : Icons.play_arrow, color: Colors.white, size: 22),
          ),
        ),
        IconButton(icon: Icon(Icons.close, color: ink.withValues(alpha: 0.7)), onPressed: app.stop),
      ]),
    );
  }

  Widget _lockedPanel(BuildContext context, Book book, Chapter ch, Color ink) {
    final isVip = ch.state == ChapterState.vip;
    return Padding(
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 52),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(Gap.xxl),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.lock_outline, size: 54, color: ink.withValues(alpha: 0.5)),
            const SizedBox(height: Gap.lg),
            Text('Chapter ${ch.n} is locked', style: AppType.hero(size: 20, color: ink)),
            const SizedBox(height: 6),
            Text(isVip ? 'VIP chapter — subscribe or unlock with coins' : 'Unlock this chapter to keep reading',
                textAlign: TextAlign.center, style: AppType.body(size: 14, color: ink.withValues(alpha: 0.7))),
            const SizedBox(height: Gap.xl),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                style: TextButton.styleFrom(backgroundColor: AppPalette.terracotta, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () async {
                  final ok = await showUnlockSheet(context, book, ch);
                  if (ok && mounted) {
                    setState(() {});
                    _loadContent();
                  }
                },
                child: Text(isVip ? 'Unlock VIP chapter' : 'Unlock for ${ch.price} coins', style: AppType.btn(color: Colors.white)),
              ),
            ),
            if (isVip) ...[
              const SizedBox(height: Gap.sm),
              TextButton(onPressed: () => context.push('/subscription'), child: Text('See VIP plans', style: AppType.btn(size: 13, color: AppPalette.plum))),
            ],
          ]),
        ),
      ),
    );
  }

  // Cuối chương (thiết kế cuoi trang.png): divider + 3 thẻ + Previous / Next chapter.
  Widget _endOfChapter(BuildContext context, Book book, Color ink, List<Chapter> chapters) {
    final hasPrev = chapters.any((c) => c.n == _chapter - 1);
    final hasNext = chapters.any((c) => c.n == _chapter + 1);
    Widget card(IconData icon, String label, VoidCallback onTap) => Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(borderRadius: rounded(14), border: Border.all(color: ink.withValues(alpha: 0.18))),
              child: Column(children: [
                Icon(icon, color: ink.withValues(alpha: 0.85), size: 22),
                const SizedBox(height: 6),
                Text(label, style: AppType.btn(size: 12.5, color: ink.withValues(alpha: 0.85))),
              ]),
            ),
          ),
        );
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: Gap.md),
        child: Text('— End of Chapter $_chapter —', style: AppType.meta(size: 12, color: ink.withValues(alpha: 0.55))),
      ),
      Row(children: [
        card(Icons.mode_comment_outlined, 'Comment', () => showChapterCommentsSheet(context, chapterId: _chapterId, scope: 'chapter')),
        const SizedBox(width: Gap.md),
        card(Icons.favorite_border, 'Support', () => showGiftSheet(context, author: book.author, storyUuid: book.uuid, chapterId: _chapterId)),
        const SizedBox(width: Gap.md),
        card(Icons.ios_share, 'Share', () => Share.share('${book.title} — Chương $_chapter\n${buildChapterWebUrl(book.id, _chapter)}')),
      ]),
      const SizedBox(height: Gap.md),
      Row(children: [
        if (hasPrev)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: BoxDecoration(borderRadius: rounded(14), border: Border.all(color: ink.withValues(alpha: 0.3))),
            child: GestureDetector(onTap: () => _goChapter(_chapter - 1, chapters), child: Text('‹ Previous', style: AppType.btn(size: 14, color: ink))),
          ),
        if (hasPrev) const SizedBox(width: Gap.md),
        if (hasNext)
          Expanded(
            child: GestureDetector(
              onTap: () => _goChapter(_chapter + 1, chapters),
              child: Container(
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: AppPalette.terracotta, borderRadius: rounded(14)),
                child: Text('Next chapter  ›', style: AppType.btn(size: 15, color: Colors.white)),
              ),
            ),
          ),
      ]),
    ]);
  }

  void _openChapterList(List<Chapter> chapters) {
    final pal = context.pal;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: pal.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (c) => SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 10),
          Container(width: 38, height: 4, decoration: BoxDecoration(color: pal.line, borderRadius: rounded(2))),
          Builder(builder: (_) {
            final bms = _reader.bookmarks(widget.bookId);
            if (bms.isEmpty) return const SizedBox.shrink();
            return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, 4),
                child: Text('Bookmarks', style: AppType.section(color: pal.ink)),
              ),
              for (final b in bms)
                ListTile(
                  dense: true,
                  leading: Icon(Icons.bookmark, size: 18, color: AppPalette.terracotta),
                  title: Text('Ch ${b.chapter} · ${b.snippet}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.body(size: 13.5, color: pal.ink)),
                  trailing: IconButton(
                    icon: Icon(Icons.close, size: 16, color: pal.muted),
                    onPressed: () { _reader.removeBookmark(widget.bookId, b.savedAt); Navigator.pop(c); _openChapterList(chapters); },
                  ),
                  onTap: () {
                    _pendingJumpOffset = b.offset;
                    Navigator.pop(c);
                    _goChapter(b.chapter, chapters);
                  },
                ),
              const Divider(height: 12),
            ]);
          }),
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.md, Gap.xl, Gap.sm),
            child: Row(children: [Text('Chapters', style: AppType.section(color: pal.ink)), const Spacer(), Text('${chapters.length}', style: AppType.meta(color: pal.muted))]),
          ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: chapters.length,
              itemBuilder: (_, i) {
                final c2 = chapters[i];
                final current = c2.n == _chapter;
                final locked = (c2.state == ChapterState.coin || c2.state == ChapterState.vip) && !context.read<AppState>().isUnlocked(widget.bookId, c2.n);
                return ListTile(
                  dense: true,
                  leading: SizedBox(width: 30, child: Text('${c2.n}', style: AppType.item(size: 13, color: current ? AppPalette.terracotta : pal.muted))),
                  title: Text(c2.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppType.body(size: 14, color: current ? AppPalette.terracotta : pal.ink)),
                  trailing: locked ? Icon(Icons.lock_outline, size: 16, color: pal.muted) : null,
                  onTap: () {
                    Navigator.pop(c);
                    _goChapter(c2.n, chapters);
                  },
                );
              },
            ),
          ),
        ]),
      ),
    );
  }

  /// Dialog chọn màu (flutter_colorpicker). Trả màu đã chọn, hoặc null nếu Huỷ.
  Future<Color?> _pickColor(Color initial) async {
    var picked = initial;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: context.pal.card,
        contentPadding: const EdgeInsets.all(Gap.md),
        content: SingleChildScrollView(
          child: ColorPicker(
            pickerColor: initial,
            onColorChanged: (col) => picked = col,
            enableAlpha: false,
            labelTypes: const [],
            pickerAreaHeightPercent: 0.7,
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text('Huỷ', style: AppType.btn(size: 14, color: context.pal.muted))),
          TextButton(onPressed: () => Navigator.pop(c, true), child: Text('Chọn', style: AppType.btn(size: 14, color: AppPalette.terracotta))),
        ],
      ),
    );
    return ok == true ? picked : null;
  }

  // Reading settings chi tiết (thiết kế set trang.png).
  void _openSettings() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: context.pal.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) {
          final pal = context.pal;
          void upd(VoidCallback fn) {
            setSheet(fn);
            setState(fn);
            _persistSettings();
          }

          Widget label(String t) => Padding(
                padding: const EdgeInsets.only(top: Gap.lg, bottom: Gap.sm),
                child: Text(t, style: AppType.meta(size: 11, color: pal.muted).copyWith(letterSpacing: 1)),
              );
          Widget pill(String text, bool sel, VoidCallback onTap, {double? w}) => GestureDetector(
                onTap: onTap,
                child: Container(
                  width: w,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: sel ? AppPalette.terracotta : pal.surf2,
                    borderRadius: rounded(12),
                    border: Border.all(color: sel ? AppPalette.terracotta : pal.line),
                  ),
                  child: Text(text, style: AppType.btn(size: 13.5, color: sel ? Colors.white : pal.ink)),
                ),
              );

          return DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.85,
            maxChildSize: 0.95,
            minChildSize: 0.5,
            builder: (c, controller) => SingleChildScrollView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.md, Gap.xl, Gap.xxl),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Center(child: Container(width: 38, height: 4, decoration: BoxDecoration(color: pal.line, borderRadius: rounded(2)))),
                const SizedBox(height: Gap.md),
                Row(children: [
                  Text('Reading settings', style: AppType.section(color: pal.ink)),
                  const SizedBox(width: 6),
                  Text('Tùy chỉnh đọc', style: AppType.meta(size: 12, color: pal.muted)),
                  const Spacer(),
                  GestureDetector(onTap: () => Navigator.pop(c), child: Text('Done', style: AppType.btn(size: 14, color: AppPalette.terracotta))),
                ]),

                // BACKGROUND
                label('BACKGROUND'),
                Row(children: [
                  for (var i = 0; i < 4; i++)
                    Expanded(
                      child: GestureDetector(
                        onTap: () => upd(() => _bg = i),
                        behavior: HitTestBehavior.opaque,
                        child: Column(children: [
                          // Ô đang chọn phóng to (37 vs 31); hộp cao cố định để hàng không nhảy.
                          SizedBox(
                            height: 37,
                            child: Center(child: Container(
                              width: _bg == i ? 37 : 31, height: _bg == i ? 37 : 31,
                              decoration: BoxDecoration(
                                color: _bgs[i], shape: BoxShape.circle,
                                border: Border.all(color: _bg == i ? AppPalette.terracotta : pal.line, width: _bg == i ? 2 : 1),
                              ),
                            )),
                          ),
                          const SizedBox(height: 4),
                          Text(_bgLabels[i], style: AppType.meta(size: 10.5, color: pal.muted)),
                        ]),
                      ),
                    ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () async {
                        final c = await _pickColor(_customBg ?? const Color(kOledBlackBg));
                        if (c != null) upd(() { _customBg = c; _bg = 4; });
                      },
                      behavior: HitTestBehavior.opaque,
                      child: Column(children: [
                        SizedBox(
                          height: 37,
                          child: Center(child: Container(
                            width: _bg == 4 ? 37 : 31, height: _bg == 4 ? 37 : 31,
                            decoration: BoxDecoration(
                              color: _customBg ?? pal.surf2, shape: BoxShape.circle,
                              border: Border.all(color: _bg == 4 ? AppPalette.terracotta : pal.line, width: _bg == 4 ? 2 : 1),
                            ),
                            child: _customBg == null ? Icon(Icons.colorize, size: 16, color: pal.muted) : null,
                          )),
                        ),
                        const SizedBox(height: 4),
                        Text('Custom', style: AppType.meta(size: 10.5, color: pal.muted)),
                      ]),
                    ),
                  ),
                ]),

                // TEXT COLOR — 1 hàng: 8 màu + ô picker (Row chia đều); ô đang chọn phóng to (34 vs 26).
                label('TEXT COLOR'),
                Row(children: [
                  for (final col in _palette)
                    Expanded(
                      child: GestureDetector(
                        onTap: () => upd(() => _textColor = col),
                        behavior: HitTestBehavior.opaque,
                        child: SizedBox(
                          height: 34,
                          child: Center(child: Container(
                            width: _textColor == col ? 34 : 26, height: _textColor == col ? 34 : 26,
                            decoration: BoxDecoration(
                              color: col, shape: BoxShape.circle,
                              border: Border.all(color: _textColor == col ? AppPalette.terracotta : pal.line, width: _textColor == col ? 2 : 1),
                            ),
                          )),
                        ),
                      ),
                    ),
                  Builder(builder: (_) {
                    final isCustom = _textColor != null && !_palette.contains(_textColor);
                    return Expanded(
                      child: GestureDetector(
                        onTap: () async {
                          final c = await _pickColor(_textColor ?? const Color(kDefaultTextColor));
                          if (c != null) upd(() => _textColor = c);
                        },
                        behavior: HitTestBehavior.opaque,
                        child: SizedBox(
                          height: 34,
                          child: Center(child: Container(
                            width: isCustom ? 34 : 26, height: isCustom ? 34 : 26,
                            decoration: BoxDecoration(
                              color: isCustom ? _textColor : pal.surf2, shape: BoxShape.circle,
                              border: Border.all(color: isCustom ? AppPalette.terracotta : pal.line, width: isCustom ? 2 : 1),
                            ),
                            child: isCustom ? null : Icon(Icons.colorize, size: 14, color: pal.muted),
                          )),
                        ),
                      ),
                    );
                  }),
                ]),

                // TEXT SIZE
                label('TEXT SIZE'),
                Row(children: [
                  Text('A', style: AppType.body(size: 13, color: pal.muted)),
                  Expanded(child: Slider(
                    value: _fontSize.clamp(14.0, 30.0),
                    min: 14, max: 30, divisions: 16,
                    activeColor: AppPalette.terracotta,
                    // Kéo: chỉ rebuild sheet (mượt) — áp vào trang đọc + lưu khi THẢ tay
                    // (setState mỗi tick sẽ re-layout cả chương dài → giật; cùng pattern BRIGHTNESS).
                    onChanged: (v) { final nv = v.roundToDouble(); setSheet(() => _fontSize = nv); },
                    onChangeEnd: (_) { setState(() {}); _persistSettings(); },
                  )),
                  Text('A', style: AppType.body(size: 20, color: pal.muted)),
                  SizedBox(width: 52, child: Text('${_fontSize.round()} pt', textAlign: TextAlign.right, style: AppType.item(size: 13.5, color: pal.ink))),
                ]),

                // FONT
                label('FONT'),
                Row(children: [
                  Expanded(child: pill('Serif', _font == 'serif', () => upd(() => _font = 'serif'))),
                  const SizedBox(width: Gap.sm),
                  Expanded(child: pill('Sans', _font == 'sans', () => upd(() => _font = 'sans'))),
                  const SizedBox(width: Gap.sm),
                  Expanded(child: pill('Dyslexia', _font == 'dyslexia', () => upd(() => _font = 'dyslexia'))),
                ]),

                // LINE
                label('LINE'),
                Row(children: [
                  Icon(Icons.format_line_spacing, size: 18, color: pal.muted),
                  Expanded(child: Slider(
                    value: _lineHeight.clamp(1.4, 3.0),
                    min: 1.4, max: 3.0, divisions: 16,
                    activeColor: AppPalette.terracotta,
                    onChanged: (v) { final nv = (v * 10).roundToDouble() / 10; setSheet(() => _lineHeight = nv); },
                    onChangeEnd: (_) { setState(() {}); _persistSettings(); },
                  )),
                  SizedBox(width: 32, child: Text(_lineHeight.toStringAsFixed(1), textAlign: TextAlign.right, style: AppType.item(size: 13.5, color: pal.ink))),
                ]),

                // MARGIN
                label('MARGIN'),
                Row(children: [
                  Expanded(child: pill('Narrow', _margin == 'narrow', () => upd(() => _margin = 'narrow'))),
                  const SizedBox(width: Gap.sm),
                  Expanded(child: pill('Medium', _margin == 'medium', () => upd(() => _margin = 'medium'))),
                  const SizedBox(width: Gap.sm),
                  Expanded(child: pill('Wide', _margin == 'wide', () => upd(() => _margin = 'wide'))),
                ]),

                // BRIGHTNESS
                label('BRIGHTNESS'),
                Row(children: [
                  Icon(Icons.brightness_low, size: 18, color: pal.muted),
                  Expanded(child: Slider(
                    value: _brightness.clamp(0.0, 1.0),
                    activeColor: AppPalette.terracotta,
                    onChanged: (v) => setSheet(() => _brightness = v),
                    onChangeEnd: (v) => _applyBrightness(v),
                  )),
                  Icon(Icons.brightness_high, size: 18, color: pal.muted),
                ]),

                // READ-ALONG
                label('READ-ALONG'),
                Row(children: [
                  Expanded(child: Text('Tô sáng câu theo audio', style: AppType.body(size: 13.5, color: pal.ink))),
                  Switch(
                    value: _readAlong,
                    activeThumbColor: AppPalette.terracotta,
                    onChanged: (v) { upd(() => _readAlong = v); _reader.saveReadAlong(v); },
                  ),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }
}
