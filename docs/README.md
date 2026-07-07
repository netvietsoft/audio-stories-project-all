# 📚 NovelVerse (Flutter) — Tài liệu kỹ thuật

> Index tài liệu cho app mobile **NovelVerse** — client Flutter của hệ
> audio-stories (đọc truyện + nghe nhạc/audiobook, coin/VIP).
> Trạng thái: mặc định chạy dữ liệu demo tĩnh (`lib/models/demo_data.dart`); **lớp nối
> backend** NestJS (`../backend/be`) đã code — bật bằng `--dart-define=USE_BACKEND=true`
> (dio + auth + repository stories/music/categories + audio HLS). Xem [07](07-noi-backend.md).
>
> Quy ước: **tin code hơn doc**. Khi doc lệch code → sửa code trước rồi cập nhật doc.
> Mọi tài liệu dưới đây dựa trên đọc code thật trong `lib/`. Cập nhật: 2026-07-02.

## Bảng tài liệu

| File | Nội dung |
|------|----------|
| [01-kien-truc.md](01-kien-truc.md) | Kiến trúc tổng: stack (Flutter + provider + go_router + just_audio + dio), entrypoint `main.dart`, các lớp (screens / state / data+api / models / theme + l10n), luồng khởi động. |
| [02-cau-truc-thu-muc.md](02-cau-truc-thu-muc.md) | Tổ chức thư mục `lib/` chi tiết, vai trò từng folder/file, quy ước đặt tên, sơ đồ phụ thuộc. |
| [03-state-va-store.md](03-state-va-store.md) | State toàn cục `AppState` (ChangeNotifier + Provider): theme, mode, ngôn ngữ, coin/VIP, yêu thích, mở khoá chương, Continue Reading, player + hàng đợi. Pattern `ValueNotifier` cho dữ liệu tần suất cao. **Persist qua `shared_preferences`** + notifier theo màn (`AsyncValue`). |
| [04-routing-va-loading.md](04-routing-va-loading.md) | Điều hướng `go_router` (bảng route đầy đủ), khung `AppShell` (IndexedStack + bottom nav + mini-player), giải pháp **loading/splash** hiện tại và đề xuất khi gọi API. |
| [05-components-dung-chung.md](05-components-dung-chung.md) | Component & token dùng chung: theme (`AppPalette`/`AppType`/`Gap`/`Radii`), `CoverImage`, bottom-sheets (`sheets.dart`), `AppShell`/`MiniPlayer`/`BottomNav`. |
| [06-cache-va-tai-nguyen.md](06-cache-va-tai-nguyen.md) | **Cache & tài nguyên**: cache giải mã ảnh (`cacheWidth`/`gaplessPlayback`), asset audio/cover, placeholder gradient; cache ảnh mạng (`cached_network_image`) + audio/HLS + cache JSON (SWR, TTL theo vùng) — đã làm. |
| [07-noi-backend.md](07-noi-backend.md) | Lộ trình thay `Demo` tĩnh bằng API thật (`../backend/be`): mapping model, envelope `{data,meta}`, audio proxy 302 / HLS, auth token, cache, ngôn ngữ nội dung. |
| [../CHANGELOG.md](../CHANGELOG.md) | Nhật ký thay đổi app (theo ngày). |

## README theo thư mục (cục bộ trong `lib/`)
Ngoài bộ docs tổng ở trên, **mỗi thư mục code có `README.md` riêng** mô tả file trong
đó + quy ước cục bộ: [`lib/`](../lib/README.md) · `lib/models` · `lib/state` · `lib/theme`
· `lib/widgets` · `lib/api` · `lib/data` · `lib/l10n` · `lib/screens` (+ `novel`/`audio`/
`money`/`account`/`onboarding`).
Docs ở đây là cái nhìn xuyên suốt; README thư mục là tra cứu tại chỗ khi sửa file.

## Đọc nhanh (30 giây)
- **2 chế độ**: Novel (đọc truyện) ↔ Audio (nghe nhạc/audiobook), đổi bằng menu ở Home. Tab bar đổi theo chế độ (xem `app_shell.dart`).
- **State**: global ở `lib/state/app_state.dart`; state tải theo màn ở notifier riêng (`stories_/music_/auth_notifier` + `AsyncValue`). Không có Redux/BLoC — chỉ `provider`.
- **Token hoá UI**: không hardcode màu/spacing rời rạc — dùng `context.pal`, `AppType.*`, `Gap.*`, `Radii.*`.
- **Dữ liệu**: mặc định `Demo.*` tĩnh (`lib/models/demo_data.dart`); bật backend (`--dart-define=USE_BACKEND=true`) → `lib/data` (repository + cache). Đọc [07](07-noi-backend.md).
- **Tài liệu thiết kế gốc** (màu/font/SVG/screens): xem `../handoff/` (01-design-system … 05-ai-build-prompt). Docs này mô tả **bản đã code**, handoff mô tả **ý đồ thiết kế**.
