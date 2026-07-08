/// Cấu hình đọc (toàn cục). Số double/int hoá để lưu prefs (JSON).
class ReaderSettings {
  const ReaderSettings({
    this.bg = 0,
    this.textColor,
    this.fontSize = 18,
    this.font = 'serif',
    this.lineHeight = 1.6,
    this.margin = 'medium',
  });

  final int bg;          // index nền: 0 Cream · 1 White · 2 Sepia · 3 Dark · 4 OLED
  final int? textColor;  // ARGB; null = Auto
  final double fontSize;
  final String font;     // serif · sans · dyslexia
  final double lineHeight;
  final String margin;   // narrow · medium · wide

  ReaderSettings copyWith({
    int? bg,
    int? textColor,
    bool clearTextColor = false,
    double? fontSize,
    String? font,
    double? lineHeight,
    String? margin,
  }) =>
      ReaderSettings(
        bg: bg ?? this.bg,
        textColor: clearTextColor ? null : (textColor ?? this.textColor),
        fontSize: fontSize ?? this.fontSize,
        font: font ?? this.font,
        lineHeight: lineHeight ?? this.lineHeight,
        margin: margin ?? this.margin,
      );

  Map<String, dynamic> toMap() => {
        'bg': bg,
        'textColor': textColor,
        'fontSize': fontSize,
        'font': font,
        'lineHeight': lineHeight,
        'margin': margin,
      };

  factory ReaderSettings.fromMap(Map map) {
    double d(dynamic v, double dflt) => v is num ? v.toDouble() : dflt;
    int i(dynamic v, int dflt) => v is num ? v.toInt() : dflt;
    return ReaderSettings(
      bg: i(map['bg'], 0),
      textColor: map['textColor'] is num ? (map['textColor'] as num).toInt() : null,
      fontSize: d(map['fontSize'], 18),
      font: (map['font'] ?? 'serif').toString(),
      lineHeight: d(map['lineHeight'], 1.6),
      margin: (map['margin'] ?? 'medium').toString(),
    );
  }
}

/// Vị trí đọc gần nhất của 1 truyện (auto-resume).
class ReaderPosition {
  const ReaderPosition({required this.chapter, required this.offset, required this.savedAt});
  final int chapter;
  final double offset;
  final int savedAt;

  Map<String, dynamic> toMap() => {'chapter': chapter, 'offset': offset, 'savedAt': savedAt};

  factory ReaderPosition.fromMap(Map map) => ReaderPosition(
        chapter: map['chapter'] is num ? (map['chapter'] as num).toInt() : 1,
        offset: map['offset'] is num ? (map['offset'] as num).toDouble() : 0,
        savedAt: map['savedAt'] is num ? (map['savedAt'] as num).toInt() : 0,
      );
}

/// Bookmark 1 vị trí đọc do người dùng lưu.
class Bookmark {
  const Bookmark({required this.chapter, required this.offset, required this.snippet, required this.savedAt});
  final int chapter;
  final double offset;
  final String snippet;
  final int savedAt;

  Map<String, dynamic> toMap() => {'chapter': chapter, 'offset': offset, 'snippet': snippet, 'savedAt': savedAt};

  factory Bookmark.fromMap(Map map) => Bookmark(
        chapter: map['chapter'] is num ? (map['chapter'] as num).toInt() : 1,
        offset: map['offset'] is num ? (map['offset'] as num).toDouble() : 0,
        snippet: (map['snippet'] ?? '').toString(),
        savedAt: map['savedAt'] is num ? (map['savedAt'] as num).toInt() : 0,
      );
}
