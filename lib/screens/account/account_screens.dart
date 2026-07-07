import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../l10n/l10n_ext.dart';
import '../../state/app_state.dart';
import '../../theme/app_dimens.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_type.dart';

/// Màn tài khoản phụ (thiết kế anh/1/2..6): Edit Profile, Language, Content
/// Settings, Claim Copyright, Become an Author. Prototype — giao diện + snackbar.

// ── Khung chung: back + tiêu đề lớn + phụ đề ──
class _Scaffold extends StatelessWidget {
  const _Scaffold({required this.title, required this.subtitle, required this.children});
  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return Scaffold(
      backgroundColor: pal.bg,
      appBar: AppBar(
        backgroundColor: pal.bg,
        elevation: 0,
        toolbarHeight: 66,
        titleSpacing: 0,
        leading: IconButton(icon: Icon(Icons.arrow_back_ios_new, size: 20, color: pal.ink), onPressed: () => context.pop()),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(title, style: AppType.hero(size: 22, color: pal.ink)),
            Text(subtitle, style: AppType.meta(size: 12, color: pal.muted)),
          ],
        ),
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(Gap.screenH, Gap.md, Gap.screenH, Gap.xxl), children: children),
    );
  }
}

Widget _label(BuildContext context, String text) => Padding(
      padding: const EdgeInsets.only(top: Gap.md, bottom: 6),
      child: Text(text.toUpperCase(), style: AppType.meta(size: 11, color: context.pal.muted).copyWith(letterSpacing: 0.8)),
    );

Widget _field(BuildContext context, String label, String hint, {int lines = 1, String? initial}) {
  final pal = context.pal;
  return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    _label(context, label),
    TextField(
      controller: initial == null ? null : TextEditingController(text: initial),
      maxLines: lines,
      style: AppType.body(size: 15, color: pal.ink),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppType.body(size: 15, color: pal.muted),
        filled: true,
        fillColor: pal.card,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: rounded(14), borderSide: BorderSide(color: pal.line)),
        enabledBorder: OutlineInputBorder(borderRadius: rounded(14), borderSide: BorderSide(color: pal.line)),
        focusedBorder: OutlineInputBorder(borderRadius: rounded(14), borderSide: const BorderSide(color: AppPalette.terracotta)),
      ),
    ),
  ]);
}

// Dropdown trưng bày (value + chevron) — form prototype.
Widget _dropdown(BuildContext context, String label, String value) {
  final pal = context.pal;
  return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    _label(context, label),
    Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      decoration: BoxDecoration(color: pal.card, borderRadius: rounded(14), border: Border.all(color: pal.line)),
      child: Row(children: [
        Expanded(child: Text(value, style: AppType.body(size: 15, color: pal.ink))),
        Icon(Icons.keyboard_arrow_down, size: 20, color: pal.muted),
      ]),
    ),
  ]);
}

Widget _noteBox(BuildContext context, String text, {bool sage = false}) {
  final pal = context.pal;
  return Container(
    padding: const EdgeInsets.all(Gap.md),
    decoration: BoxDecoration(color: sage ? pal.sageSurf : pal.surf, borderRadius: rounded(14)),
    child: Text(text, style: AppType.body(size: 13.5, color: pal.soft, w: FontWeight.w500)),
  );
}

Widget _submit(BuildContext context, String label, {Color color = AppPalette.terracotta}) => Padding(
      padding: const EdgeInsets.only(top: Gap.lg),
      child: SizedBox(
        width: double.infinity,
        height: 54,
        child: TextButton(
          style: TextButton.styleFrom(backgroundColor: color, shape: RoundedRectangleBorder(borderRadius: rounded(14))),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Submitted — thank you!')));
            context.pop();
          },
          child: Text(label, style: AppType.btn(size: 15, color: Colors.white)),
        ),
      ),
    );

// ── Edit Profile (2.png) ──
class EditProfileScreen extends StatelessWidget {
  const EditProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return _Scaffold(title: 'Edit Profile', subtitle: 'Chỉnh sửa thông tin', children: [
      const SizedBox(height: Gap.md),
      Center(
        child: Column(children: [
          Stack(children: [
            Container(
              width: 96, height: 96,
              decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [AppPalette.terracotta, AppPalette.plum])),
              alignment: Alignment.center,
              child: Text('A', style: AppType.hero(size: 40, color: Colors.white)),
            ),
            Positioned(
              right: 0, bottom: 0,
              child: Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(color: pal.card, shape: BoxShape.circle, border: Border.all(color: pal.line)),
                child: const Icon(Icons.edit, size: 15, color: AppPalette.terracotta),
              ),
            ),
          ]),
          const SizedBox(height: Gap.sm),
          Text('Change avatar · Đổi ảnh', style: AppType.btn(size: 13, color: AppPalette.terracotta)),
        ]),
      ),
      _field(context, 'Full name · Họ tên', 'Your name', initial: 'Anh Reader'),
      _field(context, 'Username', '@username', initial: '@anhreader'),
      _field(context, 'Email', 'you@email.com', initial: 'anh@foodsnear.me'),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: _dropdown(context, 'Country · Quốc gia', 'Vietnam')),
        const SizedBox(width: Gap.md),
        Expanded(child: _dropdown(context, 'Gender', 'Female')),
      ]),
      _field(context, 'Bio · Giới thiệu', 'Tell readers about yourself', lines: 3),
      _submit(context, 'Save changes · Lưu'),
    ]);
  }
}

// ── Language (3.png): Interface + Content dạng pill ──
class LanguageSettingsScreen extends StatefulWidget {
  const LanguageSettingsScreen({super.key});
  @override
  State<LanguageSettingsScreen> createState() => _LanguageSettingsScreenState();
}

class _LanguageSettingsScreenState extends State<LanguageSettingsScreen> {
  // BE hỗ trợ nội dung vi/en; UI (i18n) cũng vi/en. (Thêm ngôn ngữ → thêm ở đây + arb/messages.)
  static const _langs = {'vi': 'Tiếng Việt', 'en': 'English'};

  Widget _pill(BuildContext context, String label, bool sel, VoidCallback onTap) {
    final pal = context.pal;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        decoration: BoxDecoration(
          color: sel ? AppPalette.terracotta : pal.surf2,
          borderRadius: rounded(14),
          border: Border.all(color: sel ? AppPalette.terracotta : pal.line),
        ),
        child: Text(label, style: AppType.btn(size: 14, color: sel ? Colors.white : pal.amber)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final app = context.watch<AppState>();
    final t = context.l10n;
    return _Scaffold(title: t.settingsLanguage, subtitle: 'Giao diện & nội dung', children: [
      Padding(
        padding: const EdgeInsets.only(top: Gap.sm, bottom: Gap.sm),
        child: Row(children: [
          Text('Interface', style: AppType.item(size: 15, color: pal.ink)),
          const SizedBox(width: 6),
          Text('(chọn 1)', style: AppType.meta(size: 12, color: pal.muted)),
        ]),
      ),
      Wrap(spacing: 10, runSpacing: 10, children: [
        for (final e in _langs.entries) _pill(context, e.value, app.uiLang == e.key, () => context.read<AppState>().setUiLang(e.key)),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: Gap.xl, bottom: Gap.sm),
        child: Row(children: [
          Text('Content · Ngôn ngữ nội dung', style: AppType.item(size: 15, color: pal.ink)),
          const SizedBox(width: 6),
          Text('(chọn 1)', style: AppType.meta(size: 12, color: pal.muted)),
        ]),
      ),
      Wrap(spacing: 10, runSpacing: 10, children: [
        for (final e in _langs.entries)
          _pill(context, '${app.contentLang == e.key ? '✓ ' : ''}${e.value}', app.contentLang == e.key, () => context.read<AppState>().setContentLang(e.key)),
      ]),
      _submit(context, 'Save'),
    ]);
  }
}

// ── Content Settings (4.png): note box + card toggle ──
class ContentSettingsScreen extends StatefulWidget {
  const ContentSettingsScreen({super.key});
  @override
  State<ContentSettingsScreen> createState() => _ContentSettingsScreenState();
}

class _ContentSettingsScreenState extends State<ContentSettingsScreen> {
  final _flags = <String, (String, bool)>{
    'Teen (13+)': ('Nội dung tuổi teen', true),
    'Young Adult (16+)': ('Tuổi mới lớn', true),
    'Mature 18+': ('Nội dung người lớn · cần xác minh tuổi', false),
    'LGBTQ+ stories': ('Truyện LGBTQ+', true),
    'Violence & dark themes': ('Bạo lực · chủ đề tối', false),
  };

  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    final keys = _flags.keys.toList();
    return _Scaffold(title: 'Content Settings', subtitle: 'Độ tuổi · nội dung nhạy cảm', children: [
      const SizedBox(height: Gap.sm),
      _noteBox(context, 'Bật/tắt loại nội dung bạn muốn thấy trong feed & tìm kiếm. Nội dung 18+ yêu cầu xác minh tuổi.'),
      const SizedBox(height: Gap.lg),
      Container(
        decoration: BoxDecoration(color: pal.card, borderRadius: rounded(16), border: Border.all(color: pal.line)),
        child: Column(children: [
          for (var i = 0; i < keys.length; i++) ...[
            SwitchListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: 2),
              value: _flags[keys[i]]!.$2,
              activeTrackColor: AppPalette.terracotta,
              title: Text(keys[i], style: AppType.item(size: 14.5, color: pal.ink)),
              subtitle: Text(_flags[keys[i]]!.$1, style: AppType.meta(size: 11.5, color: pal.muted)),
              onChanged: (v) => setState(() => _flags[keys[i]] = (_flags[keys[i]]!.$1, v)),
            ),
            if (i < keys.length - 1) Divider(height: 1, thickness: 1, color: pal.line2, indent: Gap.md, endIndent: Gap.md),
          ],
        ]),
      ),
      const SizedBox(height: Gap.md),
      Center(child: Text('Tuân thủ age rating theo khu vực · không hiển thị nội dung 18+ cho tài khoản chưa xác minh',
          textAlign: TextAlign.center, style: AppType.meta(size: 11.5, color: pal.muted))),
    ]);
  }
}

// ── Claim Copyright (5.png) ──
class ClaimCopyrightScreen extends StatelessWidget {
  const ClaimCopyrightScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return _Scaffold(title: 'Claim Copyright', subtitle: 'Báo cáo vi phạm bản quyền', children: [
      const SizedBox(height: Gap.sm),
      _noteBox(context, 'Gửi yêu cầu gỡ nội dung vi phạm bản quyền của bạn. Đội ngũ sẽ phản hồi trong 48h.'),
      _field(context, "Work title · Tên tác phẩm", "e.g. Rose Rain's Revenge"),
      _field(context, 'Infringing link · Link vi phạm', 'https://...'),
      _field(context, 'Proof of ownership · Link chứng minh', 'Original source / registration URL'),
      _field(context, 'Details · Nội dung', 'Mô tả chi tiết vi phạm...', lines: 4),
      _submit(context, 'Submit claim · Gửi yêu cầu'),
    ]);
  }
}

// ── Become an Author (6.png): note sage + Genre/Chapters + nút sage ──
class BecomeAuthorScreen extends StatelessWidget {
  const BecomeAuthorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final pal = context.pal;
    return _Scaffold(title: 'Become an Author', subtitle: 'Đăng ký làm tác giả', children: [
      const SizedBox(height: Gap.sm),
      _noteBox(context, 'Chia sẻ tác phẩm của bạn — được duyệt sẽ mở Author Studio để xuất bản & kiếm tiền (70% revenue share).', sage: true),
      _field(context, 'Work title · Tên tác phẩm', 'Tên truyện của bạn'),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: _dropdown(context, 'Genre · Thể loại', 'Romance')),
        const SizedBox(width: Gap.md),
        Expanded(child: _field(context, 'Chapters · Số chương', '24')),
      ]),
      _field(context, 'Email', 'anh@foodsnear.me'),
      _field(context, 'Demo content · Nội dung demo (chương 1)', 'Dán 1-2 chương đầu để biên tập viên đánh giá...', lines: 4),
      _submit(context, 'Submit application · Gửi đăng ký', color: pal.sage),
    ]);
  }
}
