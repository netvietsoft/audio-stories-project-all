import '../repositories/comments_repository.dart';

/// Thuật toán anchor ĐỒNG NHẤT với web FE + backfill BE
/// (`backend-port/be/prisma/backfill-paragraph-anchor.ts` — "byte-identical to FE"):
/// strip tag → strip HTML entity → mọi ký tự KHÔNG chữ/số (Unicode, giữ dấu
/// tiếng Việt) → space → trim → lowercase → cắt 100 ký tự.
String makeAnchor(String s) {
  final norm = s
      .replaceAll(RegExp(r'<[^>]*>'), ' ')
      .replaceAll(RegExp(r'&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);'), ' ')
      .replaceAll(RegExp(r'[^\p{L}\p{N}]+', unicode: true), ' ')
      .trim()
      .toLowerCase();
  return norm.length <= 100 ? norm : norm.substring(0, 100);
}

/// Group comment cấp đoạn vào INDEX ĐOẠN CỦA APP (paras = đoạn đã trim, đúng thứ
/// tự render). Anchor-first — prefix 2 CHIỀU vì web gộp đoạn ≥250 từ nên anchor
/// web có thể dài hơn anchor đoạn app (và ngược lại đoạn app dài → anchor đoạn
/// dài hơn anchor comment cắt 100). Không match → fallback paragraphIndex (clamp).
Map<int, List<ChapterComment>> matchCommentsToParagraphs(
    List<ChapterComment> comments, List<String> paras) {
  final anchors = [for (final p in paras) makeAnchor(p)];
  final out = <int, List<ChapterComment>>{};
  for (final c in comments) {
    var idx = -1;
    final a = c.paragraphAnchor ?? '';
    if (a.isNotEmpty) {
      for (var i = 0; i < anchors.length; i++) {
        final p = anchors[i];
        if (p.isNotEmpty && (a.startsWith(p) || p.startsWith(a))) {
          idx = i;
          break;
        }
      }
    }
    if (idx < 0) {
      if (paras.isEmpty) continue;
      idx = (c.paragraphIndex ?? 0).clamp(0, paras.length - 1);
    }
    (out[idx] ??= []).add(c);
  }
  return out;
}
