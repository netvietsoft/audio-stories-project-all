/// Định dạng thời lượng player — CHỈ hiện đơn vị đã tới, không pad sẵn:
/// - < 1 giờ  → `m:ss`        (90 giây → "1:30", 45 phút → "45:03")
/// - >= 1 giờ → `h:mm:ss`     (90 phút → "1:30:00")
/// - >= 1 ngày → `d:hh:mm:ss` (audiobook rất dài)
String formatClock(Duration d) {
  if (d.isNegative) d = Duration.zero;
  String two(int n) => n.toString().padLeft(2, '0');
  final days = d.inDays;
  final secs = d.inSeconds % 60;
  final mins = d.inMinutes % 60;
  if (days > 0) {
    final hours = d.inHours % 24;
    return '$days:${two(hours)}:${two(mins)}:${two(secs)}';
  }
  if (d.inHours > 0) {
    return '${d.inHours}:${two(mins)}:${two(secs)}';
  }
  return '${d.inMinutes}:${two(secs)}';
}
