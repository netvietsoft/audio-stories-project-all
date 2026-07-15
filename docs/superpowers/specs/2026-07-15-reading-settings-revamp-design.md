# Reading Settings Revamp (slider + custom color) — Design

> Ngày: 2026-07-15 · App: NovelVerse Flutter (thuần app, KHÔNG đụng BE) · Trạng thái: design đã duyệt, chờ review → plan.
> Sửa sheet cài đặt đọc "Aa" trong Reader (`lib/screens/novel/reader_screen.dart`, sheet `showModalBottomSheet` ~dòng 757-928).

## 1. Mục tiêu

4 thay đổi user yêu cầu (2026-07-15):
1. **TEXT SIZE**: thay 2 nút `A−`/`A+` bằng **Slider 14→30**.
2. **LINE**: thay 4 pill (1.4/1.6/1.8/2.0) bằng **Slider 1.4→3.0**.
3. **BACKGROUND**: thay ô **OLED** bằng ô **Custom** mở color picker — user tự chọn màu nền.
4. **TEXT COLOR**: **bỏ chip Auto**; mặc định **Đen**; ô cuối bảng là color picker — user tự chọn màu chữ.

## 2. Hiện trạng (đối chiếu code)

- `_bgs` = 5 nền [Cream, White, Sepia, Dark(#15110C), OLED(#000)]; `_inks` = màu chữ auto theo nền; `_bg` index lưu `ReaderSettings.bg`.
- `_palette` = [null(Auto), nâu đậm #2A2118, +7 màu]; `_textColor == null` nghĩa là Auto → `ink = _inks[_bg]`.
- `_fontSize` clamp 14–26 (nút bấm); `_lineHeight` 4 giá trị pill.
- `ReaderSettings{bg:int, textColor:int?, fontSize, font, lineHeight, margin}` lưu prefs key `reader.settings` (JSON), load 1 lần ở `initState`.

## 3. Thiết kế

### 3.1. Dependency mới

`flutter_colorpicker` (đã chốt với user, thay vì tự viết picker) — dùng `ColorPicker`/`HueRingPicker` trong `AlertDialog`, nút Chọn/Huỷ. Chỉ import trong reader (chỗ mở dialog).

### 3.2. Model — `ReaderSettings` (lib/data/reader/reader_models.dart)

- Thêm `customBg: int?` (ARGB màu nền custom; chỉ có nghĩa khi `bg == 4`). Default `null`.
- `textColor` giữ kiểu `int?` cho JSON cũ nhưng **semantics đổi**: app không bao giờ GHI `null` nữa; `null` chỉ còn xuất hiện khi đọc settings cũ (Auto) → resolve khi load (xem 3.4).
- `copyWith` thêm `customBg`; `toMap`/`fromMap` thêm key `customBg` (thiếu key → null). KHÔNG đổi key prefs, KHÔNG migration file.

### 3.3. UI sheet (reader_screen.dart)

| Khối | Thay đổi |
|---|---|
| TEXT SIZE | `Slider(min:14, max:30, divisions:16)` màu terracotta (style như slider BRIGHTNESS) + text `${_fontSize.round()} pt` bên phải. `onChanged` cập nhật live (setSheet+setState), `onChangeEnd` persist (tránh ghi prefs mỗi frame kéo). |
| LINE | `Slider(min:1.4, max:3.0, divisions:16)` (bước 0.1) + text `_lineHeight.toStringAsFixed(1)`. Persist ở `onChangeEnd`. |
| BACKGROUND | 4 vòng preset (bỏ OLED khỏi `_bgs`/`_bgLabels` hiển thị — thực tế giữ mảng, chỉ render 0-3) + **ô 5 "Custom"**: vòng tròn fill = `customBg` hiện tại (chưa có → icon `Icons.colorize` trên nền `surf2`), viền terracotta khi `_bg == 4`. Tap → mở picker dialog, chọn xong: `_bg = 4`, `_customBg = màu`, persist. |
| TEXT COLOR | Bảng = **[Đen #FF000000 (đầu)] + 8 màu cũ (giữ nguyên)** + **ô cuối picker** (vòng tròn gradient/icon colorize; viền terracotta khi màu đang chọn là custom ngoài bảng). Bỏ chip Auto. Tap ô picker → dialog chọn màu chữ → `_textColor = màu`, persist. |

Render nền/chữ: `bg = _bg == 4 ? Color(_customBg ?? 0xFF000000) : _bgs[_bg]`; `ink = _textColor!` (sau load luôn non-null).

### 3.4. Tương thích ngược (load 1 lần ở `initState`)

| Settings cũ | Resolve |
|---|---|
| `bg == 4` (OLED cũ), `customBg == null` | `customBg = 0xFF000000` — user OLED cũ không thấy khác gì. |
| `textColor == null` (Auto cũ) | Nền **tối** (`bg == 3`, hoặc `bg == 4` với customBg luminance < 0.5) → `textColor = _inks[bg]` (kem sáng như Auto cũ); nền **sáng** → `textColor = 0xFF000000` (Đen). Tránh "chữ đen trên nền đen" cho user cũ đang dùng Dark/OLED + Auto. |
| Fresh install | `bg = 0` (Cream), `textColor = Đen` mặc định. |

Resolve xong ghi lại qua `_persistSettings()` như bình thường (lần persist kế tiếp tự mang giá trị đã resolve — không cần ghi ngay lúc load).

### 3.5. Phạm vi — KHÔNG đụng

Brightness, Read-along, Font, Margin, top bar, luồng đọc/audio, BE. Không đổi key prefs.

## 4. Test

- `reader_models_test`: roundtrip `customBg` qua toMap/fromMap; map cũ thiếu `customBg` → null; copyWith giữ/đổi customBg.
- Resolve rule (nếu tách thành hàm thuần — khuyến nghị tách `resolveLegacySettings(ReaderSettings) → ReaderSettings` để test được): bg=4+null→customBg đen; textColor null + nền tối → ink sáng; null + nền sáng → đen; textColor có sẵn → giữ nguyên.
- Slider range: fontSize clamp 14–30, lineHeight 1.4–3.0 (giá trị cũ 18/1.6 nằm trong range — không cần migrate).
- `flutter analyze` 0 lỗi/0 cảnh báo; full `flutter test` pass.

## 5. Quyết định đã chốt

- Picker: **package `flutter_colorpicker`** (user chọn 2026-07-15) — 1 dep mới.
- Bỏ hẳn Auto (theo yêu cầu); bù bằng rule resolve 1 lần cho user cũ (3.4).
- OLED preset biến mất khỏi UI nhưng hành vi cũ được bảo toàn qua `bg=4 → customBg đen`.
- Slider persist ở `onChangeEnd` (không ghi prefs mỗi frame).
