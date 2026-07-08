import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/reader/reader_models.dart';

void main() {
  test('ReaderSettings round-trip + defaults khi thiếu key', () {
    const s = ReaderSettings(bg: 3, textColor: 0xFF112233, fontSize: 20, font: 'sans', lineHeight: 1.8, margin: 'wide');
    final back = ReaderSettings.fromMap(s.toMap());
    expect(back.bg, 3);
    expect(back.textColor, 0xFF112233);
    expect(back.fontSize, 20);
    expect(back.font, 'sans');
    expect(back.lineHeight, 1.8);
    expect(back.margin, 'wide');
    // thiếu key → default
    final def = ReaderSettings.fromMap(const {});
    expect(def.bg, 0);
    expect(def.textColor, isNull);
    expect(def.fontSize, 18);
    expect(def.font, 'serif');
    expect(def.lineHeight, 1.6);
    expect(def.margin, 'medium');
  });

  test('ReaderPosition + Bookmark round-trip', () {
    const p = ReaderPosition(chapter: 5, offset: 123.4, savedAt: 999);
    final pb = ReaderPosition.fromMap(p.toMap());
    expect(pb.chapter, 5);
    expect(pb.offset, 123.4);
    expect(pb.savedAt, 999);

    const b = Bookmark(chapter: 2, offset: 50.0, snippet: 'hello', savedAt: 111);
    final bb = Bookmark.fromMap(b.toMap());
    expect(bb.chapter, 2);
    expect(bb.offset, 50.0);
    expect(bb.snippet, 'hello');
    expect(bb.savedAt, 111);
  });
}
