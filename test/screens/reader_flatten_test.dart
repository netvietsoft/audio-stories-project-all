import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/screens/novel/reader_screen.dart';

void main() {
  test('flattenHardBreaks: \\n đơn → space, GIỮ NGUYÊN độ dài (không lệch offset read-along)', () {
    const para = 'mình đã bắt đầu cuộc sống lưu lạc\nrồi chăng Những đêm giật mình';
    final out = flattenHardBreaks(para);
    expect(out.contains('\n'), isFalse);
    expect(out.length, para.length); // thay 1:1 — cs/ce của timing cues vẫn trỏ đúng ký tự
    expect(out, 'mình đã bắt đầu cuộc sống lưu lạc rồi chăng Những đêm giật mình');
  });

  test('đoạn sạch không đổi; double-space nguồn được giữ nguyên (không đụng độ dài)', () {
    expect(flattenHardBreaks('câu văn bình thường.'), 'câu văn bình thường.');
    expect(flattenHardBreaks('thê lương  từ\ncác cánh đồng'), 'thê lương  từ các cánh đồng');
  });
}
