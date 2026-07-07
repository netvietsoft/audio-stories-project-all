import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/offline/connectivity_service.dart';

void main() {
  test('setOnline cập nhật + notify', () {
    final c = ConnectivityService();
    var notified = 0;
    c.addListener(() => notified++);
    expect(c.isOnline, true); // mặc định coi như online
    c.setOnline(false);
    expect(c.isOnline, false);
    expect(notified, 1);
  });
}
