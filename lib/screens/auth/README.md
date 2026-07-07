# `lib/screens/auth/` — Xác thực (UI)

Màn đăng nhập, dùng `AuthNotifier` (state) + `AuthRepository` (API). Tài liệu: [docs/07](../../../docs/07-noi-backend.md).

## File
| File | Màn | Route |
|---|---|---|
| `login_screen.dart` | `LoginScreen` — email + mật khẩu → `POST /auth/login` | `/login` |

## Luồng
- `auth.login(email, password)` → thành công: `context.pop()` (hoặc `/home`); lỗi: hiện `auth.error`.
- Token lưu ở `flutter_secure_storage` (qua `AuthRepository`/`TokenStore`), Bearer gắn vào `ApiClient`.
- `USE_BACKEND=false` (Demo) → hiện cảnh báo, login cần bật backend.
- Vào từ **Profile** → nút "Đăng nhập" (khi chưa đăng nhập) / "Đăng xuất".

## Còn lại
- Đăng ký + verify code UI, quên/đổi mật khẩu UI, đăng nhập Google (BE có `/auth/google`).
- Guard route theo trạng thái đăng nhập (hiện các màn vẫn mở; entitlement do BE kiểm).
