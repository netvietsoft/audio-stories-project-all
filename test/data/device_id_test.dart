import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:novelverse/data/device_id.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('sinh deviceId mới (>=8 ký tự) khi chưa có, và lưu lại', () async {
    final id = await getOrCreateDeviceId();
    expect(id.length, greaterThanOrEqualTo(8));

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('wta_device_id'), id);
  });

  test('trả lại đúng deviceId đã lưu ở lần gọi sau (persist)', () async {
    final first = await getOrCreateDeviceId();
    final second = await getOrCreateDeviceId();
    expect(second, first);
  });

  test('đọc lại deviceId đã có sẵn trong prefs (không sinh mới)', () async {
    SharedPreferences.setMockInitialValues({'wta_device_id': 'existing-id-123'});
    final id = await getOrCreateDeviceId();
    expect(id, 'existing-id-123');
  });
}
