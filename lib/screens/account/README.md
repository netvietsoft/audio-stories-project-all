# `lib/screens/account/` — Màn tài khoản phụ

Các màn cài đặt/biểu mẫu mở từ Profile. **Prototype**: chỉ giao diện + snackbar xác nhận,
chưa lưu backend. Nguồn thiết kế: handoff 03-screens "Account".

## File
| File | Chứa các màn (1 file gộp) |
|---|---|
| `account_screens.dart` | `EditProfileScreen`, `LanguageSettingsScreen`, `ContentSettingsScreen`, `ClaimCopyrightScreen`, `BecomeAuthorScreen` |

## Các màn & route
| Màn | Route | Nội dung |
|---|---|---|
| `EditProfileScreen` | `/edit-profile` | Avatar + form Display name/Email/Bio → Save (snackbar). |
| `LanguageSettingsScreen` | `/language` | Radio ngôn ngữ app + chip ngôn ngữ nội dung (multi-select cục bộ). |
| `ContentSettingsScreen` | `/content-settings` | Switch lọc thể loại (Teen/YA/18+/LGBTQ+/Violence). |
| `ClaimCopyrightScreen` | `/claim-copyright` | Form khiếu nại bản quyền → Submit (snackbar). |
| `BecomeAuthorScreen` | `/become-author` | Form đăng ký tác giả → Apply (snackbar). |

## Helper dùng chung trong file
- `_Scaffold(title, children)` — khung AppBar back + ListView (thống nhất các màn).
- `_field(label, hint, lines, initial)` — TextField bọc style chung.
- `_submit(label, color)` — nút submit → snackbar + `context.pop()`.

## Khi sửa
- Tách 1 màn thành file riêng nếu phình to. Giữ `_Scaffold/_field/_submit` để đồng nhất.
- Khi nối backend: `EditProfile` → `PATCH /auth/me`; Language/Content → lưu prefs/BE; Copyright/Author → API tương ứng. Hiện chỉ snackbar. Xem [docs/07](../../../docs/07-noi-backend.md).
