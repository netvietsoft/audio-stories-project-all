import '../../models/models.dart';

/// Map JSON `/auth/me` → [AppUser].
/// BE trả snake_case: email, name, avatar_url, role, pulse_balance, vip_tier.
abstract final class UserMapper {
  static AppUser fromJson(Map<String, dynamic> j) {
    return AppUser(
      email: (j['email'] ?? '').toString(),
      name: (j['name'] ?? j['displayName'] ?? '').toString(),
      avatarUrl: (j['avatar_url'] ?? j['avatarUrl'])?.toString(),
      pulseBalance: _asInt(j['pulse_balance'] ?? j['pulseBalance']),
      vipTier: _asInt(j['vip_tier'] ?? j['vipTier']),
      role: (j['role'])?.toString(),
    );
  }

  static int _asInt(dynamic v) =>
      v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0);
}
