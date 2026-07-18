import 'package:google_sign_in/google_sign_in.dart';

import 'api_env.dart';
import 'api_exception.dart';

/// Bọc google_sign_in v7 sau interface mỏng để AuthNotifier fake được trong test.
/// [idToken] trả null khi USER HỦY popup (không throw); lỗi khác → ApiException.
class GoogleAuth {
  bool _inited = false;

  Future<String?> idToken() async {
    try {
      final signIn = GoogleSignIn.instance;
      if (!_inited) {
        await signIn.initialize(serverClientId: ApiEnv.googleServerClientId);
        _inited = true;
      }
      final account = await signIn.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) {
        throw ApiException('google_no_token', 'Không lấy được Google token');
      }
      return token;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      throw ApiException('google_${e.code.name}', 'Đăng nhập Google thất bại');
    }
  }
}
