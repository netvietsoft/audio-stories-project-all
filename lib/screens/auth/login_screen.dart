import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/api_env.dart';
import '../../state/auth_notifier.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';

/// Đăng nhập bằng email + mật khẩu (`POST /auth/login`). Thành công → quay lại
/// (hoặc /home). Token do AuthRepository lưu secure storage + gắn ApiClient.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthNotifier>();
    final ok = await auth.login(_email.text.trim(), _password.text);
    if (!mounted) return;
    if (ok) {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/home');
      }
    }
  }

  Future<void> _googleSignIn() async {
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthNotifier>();
    final ok = await auth.loginWithGoogle();
    if (!mounted) return;
    if (ok) {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/home');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final auth = context.watch<AuthNotifier>();
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.close, color: pal.ink), onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.sm, Gap.xl, Gap.xxl),
        children: [
          Center(
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                borderRadius: rounded(18),
                gradient: const LinearGradient(colors: [AppPalette.terracotta, Color(0xFF9A5A2A)]),
              ),
              alignment: Alignment.center,
              child: Text('N', style: AppType.hero(size: 38, color: Colors.white)),
            ),
          ),
          const SizedBox(height: Gap.lg),
          Center(child: Text('Đăng nhập NovelVerse', style: AppType.hero(size: 24, color: pal.ink))),
          const SizedBox(height: Gap.xl),
          if (!ApiEnv.useBackend)
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.md),
              child: Text('⚠ Đang chạy chế độ Demo (USE_BACKEND=false) — đăng nhập cần bật backend.',
                  style: AppType.meta(size: 12, color: AppPalette.rank2)),
            ),
          _field(context, 'Email', _email, TextInputType.emailAddress),
          const SizedBox(height: Gap.md),
          _passwordField(context),
          if (auth.error != null) ...[
            const SizedBox(height: Gap.md),
            Text(auth.error!, style: AppType.meta(size: 12, color: AppPalette.rank1)),
          ],
          const SizedBox(height: Gap.xl),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              style: TextButton.styleFrom(backgroundColor: AppPalette.terracotta, padding: const EdgeInsets.symmetric(vertical: 14)),
              onPressed: auth.busy ? null : _submit,
              child: auth.busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('Đăng nhập', style: AppType.btn(color: Colors.white)),
            ),
          ),
          const SizedBox(height: Gap.lg),
          Row(children: [
            Expanded(child: Divider(color: pal.line)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.md),
              child: Text('hoặc', style: AppType.meta(size: 12, color: pal.muted)),
            ),
            Expanded(child: Divider(color: pal.line)),
          ]),
          const SizedBox(height: Gap.lg),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: BorderSide(color: pal.line),
                shape: RoundedRectangleBorder(borderRadius: rounded(12)),
              ),
              onPressed: auth.busy ? null : _googleSignIn,
              icon: Text('G', style: AppType.hero(size: 18, color: AppPalette.terracotta)),
              label: Text('Tiếp tục với Google', style: AppType.btn(color: pal.ink)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(BuildContext context, String label, TextEditingController ctrl, TextInputType kb) {
    final pal = context.pal;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: AppType.meta(size: 12, color: pal.muted)),
      const SizedBox(height: 6),
      TextField(
        controller: ctrl,
        keyboardType: kb,
        autocorrect: false,
        style: AppType.body(size: 14, color: pal.ink),
        decoration: _dec(context),
      ),
    ]);
  }

  Widget _passwordField(BuildContext context) {
    final pal = context.pal;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Mật khẩu', style: AppType.meta(size: 12, color: pal.muted)),
      const SizedBox(height: 6),
      TextField(
        controller: _password,
        obscureText: _obscure,
        style: AppType.body(size: 14, color: pal.ink),
        onSubmitted: (_) => _submit(),
        decoration: _dec(context).copyWith(
          suffixIcon: IconButton(
            icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, color: pal.muted, size: 20),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        ),
      ),
    ]);
  }

  InputDecoration _dec(BuildContext context) {
    final pal = context.pal;
    return InputDecoration(
      filled: true,
      fillColor: pal.surf2,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(borderRadius: rounded(12), borderSide: BorderSide(color: pal.line)),
      enabledBorder: OutlineInputBorder(borderRadius: rounded(12), borderSide: BorderSide(color: pal.line)),
      focusedBorder: OutlineInputBorder(borderRadius: rounded(12), borderSide: const BorderSide(color: AppPalette.terracotta)),
    );
  }
}
