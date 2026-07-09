import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

/// Khoá lưu deviceId trong SharedPreferences (persist qua các lần mở app).
const _kDeviceId = 'wta_device_id';

/// Lấy deviceId đã lưu, hoặc sinh mới (không dùng package `uuid`) + lưu lại.
/// Dùng để gắn kèm các event tracking (vd search-open) — không định danh user thật.
Future<String> getOrCreateDeviceId() async {
  final prefs = await SharedPreferences.getInstance();
  final existing = prefs.getString(_kDeviceId);
  if (existing != null && existing.isNotEmpty) return existing;

  final id = 'd-${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(0x7fffffff).toRadixString(16)}';
  await prefs.setString(_kDeviceId, id);
  return id;
}
