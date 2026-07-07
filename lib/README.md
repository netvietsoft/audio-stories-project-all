# `lib/` — Mã nguồn NovelVerse

Thư mục gốc mã nguồn Flutter. Tài liệu kiến trúc đầy đủ ở [`../docs/`](../docs/README.md);
file này là chỉ mục cục bộ cho `lib/`.

## File gốc
| File | Vai trò |
|---|---|
| `main.dart` | Entrypoint: `WidgetsFlutterBinding.ensureInitialized()` → tạo `AppState` → `await init()` (nạp persist) → `runApp` với `ChangeNotifierProvider.value` + `MaterialApp.router`. |
| `router.dart` | Cấu hình `go_router` — toàn bộ route (xem [docs/04](../docs/04-routing-va-loading.md)). |

## Thư mục con (mỗi folder có README riêng)
| Folder | Nội dung | README |
|---|---|---|
| `api/` | Kết nối backend: env (domain/IP) + endpoints + ApiClient | [api/README.md](api/README.md) |
| `data/` | Repository + mapper (API → model UI) | [data/README.md](data/README.md) |
| `models/` | Kiểu dữ liệu + dữ liệu demo tĩnh | [models/README.md](models/README.md) |
| `state/` | `AppState` + notifier theo feature (provider) | [state/README.md](state/README.md) |
| `theme/` | Token màu/chữ/spacing + ThemeData | [theme/README.md](theme/README.md) |
| `widgets/` | Component dùng chung | [widgets/README.md](widgets/README.md) |
| `screens/` | UI theo feature | [screens/README.md](screens/README.md) |

> Luồng dữ liệu online: `screen → notifier (state/) → repository (data/) → ApiClient (core/) → backend`.
> Bật bằng `--dart-define=USE_BACKEND=true` (mặc định tắt → dùng `Demo`).

## Quy ước nhanh
- **State chia sẻ** → `AppState`; **state 1 màn** → `setState`/`StatefulBuilder` cục bộ.
- **Không hardcode** màu/spacing/text-style — dùng `context.pal`, `AppType.*`, `Gap.*`, `Radii.*`.
- **Điều hướng** qua `go_router` (`context.go/push`), tham số qua `state.pathParameters`/`uri.queryParameters`.
- **Dữ liệu** hiện từ `Demo.*` (`models/demo_data.dart`) — điểm thay bằng API: [docs/07](../docs/07-noi-backend.md).
