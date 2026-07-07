import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Trạng thái online/offline. Mặc định coi là online tới khi plugin báo khác.
class ConnectivityService extends ChangeNotifier {
  bool _online = true;
  bool get isOnline => _online;

  @visibleForTesting
  void setOnline(bool v) {
    if (_online == v) return;
    _online = v;
    notifyListeners();
  }

  Future<void> start() async {
    final c = Connectivity();
    void apply(List<ConnectivityResult> r) =>
        setOnline(r.any((x) => x != ConnectivityResult.none));
    apply(await c.checkConnectivity());
    c.onConnectivityChanged.listen(apply);
  }
}
