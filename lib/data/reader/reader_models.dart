/// Cấu hình đọc (toàn cục). Số double/int hoá để lưu prefs (JSON).
class ReaderSettings {
  const ReaderSettings({
    this.bg = 0,
    this.customBg,
    this.textColor,
    this.fontSize = 18,
    this.font = 'serif',
    this.lineHeight = 1.6,
    this.margin = 'medium',
  });

  final int bg;          // index nền: 0 Cream · 1 White · 2 Sepia · 3 Dark · 4 Custom
  final int? customBg;   // ARGB nền custom; chỉ có nghĩa khi bg == 4
  final int? textColor;  // ARGB; null chỉ còn ở settings cũ (Auto) → resolveLegacySettings xử lý
  final double fontSize;
  final String font;     // serif · sans · dyslexia
  final double lineHeight;
  final String margin;   // narrow · medium · wide

  ReaderSettings copyWith({
    int? bg,
    int? customBg,
    int? textColor,
    bool clearTextColor = false,
    double? fontSize,
    String? font,
    double? lineHeight,
    String? margin,
  }) =>
      ReaderSettings(
        bg: bg ?? this.bg,
        customBg: customBg ?? this.customBg,
        textColor: clearTextColor ? null : (textColor ?? this.textColor),
        fontSize: fontSize ?? this.fontSize,
        font: font ?? this.font,
        lineHeight: lineHeight ?? this.lineHeight,
        margin: margin ?? this.margin,
      );

  Map<String, dynamic> toMap() => {
        'bg': bg,
        'customBg': customBg,
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
      customBg: map['customBg'] is num ? (map['customBg'] as num).toInt() : null,
      textColor: map['textColor'] is num ? (map['textColor'] as num).toInt() : null,
      fontSize: d(map['fontSize'], 18),
      font: (map['font'] ?? 'serif').toString(),
      lineHeight: d(map['lineHeight'], 1.6),
      margin: (map['margin'] ?? 'medium').toString(),
    );
  }
}

/// Màu chữ mặc định (Đen) — semantics mới sau khi bỏ Auto.
const int kDefaultTextColor = 0xFF000000;

/// Màu chữ auto CŨ trên nền tối (kem sáng — trùng `_inks[3]` của Reader).
const int kLegacyDarkInk = 0xFFE8DCC4;

/// Resolve settings bản cũ về semantics mới. Gọi 1 lần lúc load (initState Reader):
/// - `bg == 4` (OLED cũ) thiếu `customBg` → `customBg = đen` (giữ trải nghiệm OLED).
/// - `textColor == null` (Auto cũ) → nền tối: [kLegacyDarkInk]; nền sáng: [kDefaultTextColor]
///   (tránh "chữ đen trên nền đen" cho user cũ đang dùng Dark/OLED + Auto).
ReaderSettings resolveLegacySettings(ReaderSettings s) {
  var out = s;
  if (out.bg == 4 && out.customBg == null) {
    out = out.copyWith(customBg: kOledBlackBg);
  }
  if (out.textColor == null) {
    out = out.copyWith(textColor: _isDarkBg(out) ? kLegacyDarkInk : kDefaultTextColor);
  }
  return out;
}

/// Nền OLED cũ (đen thuần) — giá trị customBg khi migrate bg=4 cũ.
const int kOledBlackBg = 0xFF000000;

bool _isDarkBg(ReaderSettings s) {
  if (s.bg == 3) return true; // Dark preset
  if (s.bg == 4) {
    final c = s.customBg ?? kOledBlackBg;
    final r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }
  return false; // 0 Cream · 1 White · 2 Sepia — nền sáng
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
