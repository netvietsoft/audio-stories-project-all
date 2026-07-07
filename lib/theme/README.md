# `lib/theme/` — Token thiết kế & ThemeData

Token-hoá toàn bộ màu/chữ/spacing. Tài liệu đầy đủ: [docs/05 — Component dùng chung](../../docs/05-components-dung-chung.md).
Nguồn thiết kế: [`../../handoff/01-design-system.md`](../../../handoff/01-design-system.md).

## Files
| File | Nội dung | Truy cập |
|---|---|---|
| `app_palette.dart` | `AppPalette extends ThemeExtension` — token màu Light + Dark + brand cố định | `context.pal.*` / `AppPalette.*` |
| `app_type.dart` | `AppType` — text style Spectral (serif) + Figtree (sans) | `AppType.hero/section/serif/item/body/meta/btn/tabLabel` |
| `app_dimens.dart` | `Gap` (spacing) + `Radii` (bo góc) + `rounded(r)` | `Gap.*`, `Radii.*`, `rounded()` |
| `app_theme.dart` | `AppTheme.light()/dark()` — dựng `ThemeData` (M3), gắn `AppPalette` vào `extensions`, font mặc định Figtree | dùng ở `main.dart` |

## Quy ước dùng màu
- **Phụ thuộc nền** (chữ/viền/surface, đổi theo sáng-tối): `context.pal.bg/card/ink/muted/line/surf2/...`.
- **Brand cố định** (không đổi theo theme): `AppPalette.terracotta` (Novel), `AppPalette.plum` (Audio), `coinA/coinB`, `rank1/rank2/rank3`.
- ⚠ **Đừng** viết `Color(0xFF...)` rời trong screens (trừ gradient đặc thù). Thiếu token → thêm vào đây.

## Khi sửa
- Thêm màu → thêm field vào `AppPalette` (cả `light` và `dark`) hoặc hằng brand `static const`.
- Thêm cỡ/kiểu chữ → thêm helper trong `AppType` (giữ 2 họ font Spectral/Figtree).
- Đổi spacing/radius chuẩn → sửa `Gap`/`Radii` (lan toả toàn app, kiểm lại layout).
