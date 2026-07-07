/// Lỗi chuẩn hoá từ tầng API. Backend trả lỗi dạng
/// `{ error: { code, message, details? }, meta }` → map về đây để UI bind theo [code].
class ApiException implements Exception {
  ApiException(this.code, this.message, {this.status});

  /// Mã lỗi ổn định từ backend (vd 'UNAUTHORIZED', 'NOT_FOUND') hoặc mã client
  /// ('network', 'timeout', 'unknown').
  final String code;

  /// Thông điệp hiển thị được (đã có sẵn từ BE hoặc fallback client).
  final String message;

  /// HTTP status nếu có.
  final int? status;

  bool get isNetwork => code == 'network' || code == 'timeout';

  @override
  String toString() => 'ApiException($code${status != null ? ' $status' : ''}): $message';
}
