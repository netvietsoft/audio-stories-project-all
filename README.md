# NovelVerse (Flutter)

App mobile **NovelVerse** — client của hệ audio-stories: đọc truyện + nghe nhạc/
audiobook, có coin/VIP. Stack: Flutter (Material 3) + `provider` (state) +
`go_router` (routing) + `just_audio` (audio HLS) + `dio` (backend).

> Trạng thái: mặc định chạy bằng dữ liệu demo tĩnh (`lib/models/demo_data.dart`); **lớp
> nối backend NestJS đã có** (dio + auth + repository + audio HLS), bật bằng
> `--dart-define=USE_BACKEND=true`. Chi tiết & phần còn lại: [docs/07](docs/07-noi-backend.md).

## 📖 Tài liệu kỹ thuật → [`docs/`](docs/README.md)

| | |
|---|---|
| [01 — Kiến trúc](docs/01-kien-truc.md) | stack, entrypoint, lớp, luồng khởi động |
| [02 — Cấu trúc thư mục](docs/02-cau-truc-thu-muc.md) | bản đồ `lib/`, quy ước, đặt file mới ở đâu |
| [03 — State & Store](docs/03-state-va-store.md) | `AppState` (provider), pattern `ValueNotifier`, persist |
| [04 — Routing & Loading](docs/04-routing-va-loading.md) | go_router, `AppShell`, splash/loading |
| [05 — Component dùng chung](docs/05-components-dung-chung.md) | theme token, `CoverImage`, sheets |
| [06 — Cache & tài nguyên](docs/06-cache-va-tai-nguyen.md) | cache ảnh/audio, assets, đề xuất cache mạng |
| [07 — Nối backend](docs/07-noi-backend.md) | thay Demo bằng API, mapping, auth, cache dữ liệu |

Tài liệu thiết kế gốc (màu/font/SVG/screens): [`../handoff/`](../handoff/README.md).

## Chạy nhanh

```bash
flutter pub get
flutter run        # thiết bị/emulator đang kết nối
flutter analyze    # lint
flutter test
```

Yêu cầu Dart SDK `^3.12.2` (xem `pubspec.yaml`).
