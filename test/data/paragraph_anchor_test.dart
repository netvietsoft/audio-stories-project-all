import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/comments/paragraph_anchor.dart';
import 'package:novelverse/data/repositories/comments_repository.dart';

ChapterComment _c({String? anchor, int? idx}) => ChapterComment(
      id: 'x', content: 'nd', createdAt: '', paragraphIndex: idx, paragraphAnchor: anchor,
      userName: 'u', avatarUrl: null, reactions: const {'helpful': 0, 'like': 0, 'love': 0}, repliesCount: 0);

void main() {
  test('makeAnchor: giữ chữ tiếng Việt có dấu, dấu câu/xuống dòng → space, lowercase, cắt 100', () {
    expect(makeAnchor('"Anh yêu em," cô nói.\nRồi đi.'), 'anh yêu em cô nói rồi đi');
    expect(makeAnchor('<p>Hello &nbsp; <b>World</b>!</p>'), 'hello world');
    final long = List.filled(40, 'chữ').join(' '); // 40*3 + 39 = 159 ký tự normalize
    expect(makeAnchor(long).length, 100);
  });

  test('match: anchor khớp chính xác → đúng đoạn', () {
    final paras = ['Đoạn một nội dung.', 'Đoạn hai nội dung khác.'];
    final m = matchCommentsToParagraphs([_c(anchor: makeAnchor(paras[1]), idx: 0)], paras);
    expect(m[1], hasLength(1)); // anchor thắng index sai
    expect(m[0], isNull);
  });

  test('match: anchor web DÀI hơn (chunk gộp ≥250 từ) vẫn khớp đoạn đầu chunk', () {
    final paras = ['Câu mở đầu của chunk.', 'Phần sau của chunk cũ.'];
    // anchor web = normalize cả chunk (đoạn 0 + đoạn 1) — startsWith anchor đoạn 0
    final webAnchor = makeAnchor('${paras[0]} ${paras[1]}');
    final m = matchCommentsToParagraphs([_c(anchor: webAnchor, idx: 99)], paras);
    expect(m[0], hasLength(1));
  });

  test('match: anchor null/rỗng → fallback index (clamp)', () {
    final paras = ['a', 'b'];
    final m = matchCommentsToParagraphs([_c(anchor: null, idx: 7), _c(anchor: '', idx: null)], paras);
    expect(m[1], hasLength(1)); // idx 7 clamp → 1
    expect(m[0], hasLength(1)); // idx null → 0
  });
}
