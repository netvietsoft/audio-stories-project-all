import 'package:flutter/widgets.dart';

import 'gen/app_localizations.dart';

/// Truy cập chuỗi dịch gọn: `context.l10n.navHome`.
extension L10nX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
