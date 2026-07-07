# `lib/data/` — Tầng dữ liệu (repository + mapper)

Trung gian giữa `api/` (API thô) và UI: trả **model UI** (`lib/models`), ẩn
envelope/endpoint. Tài liệu: [docs/07](../../docs/07-noi-backend.md).

## Cấu trúc
| File | Vai trò |
|---|---|
| `repositories/stories_repository.dart` | `StoriesRepository`: `explore()` → `PagedBooks`; `detail(slug)` → `StoryDetail{book, chapters}`; `chapterContent(id)` → `ChapterContent`; `bySlug(slug)` → `Book`. |
| `repositories/music_repository.dart` | `MusicRepository.list({page,limit,search})` → `List<Song>`. |
| `repositories/audio_repository.dart` | `AudioRepository.chapterAudioUrl(id)` — resolve `/chapters/:id/audio` (302, kèm Bearer) → URL audio thật để phát. |
| `repositories/auth_repository.dart` | `AuthRepository`: login/verifyCode/me/refresh/logout/changePassword/restoreSession. Đọc refresh từ Set-Cookie, lưu qua `TokenStore` (secure storage), gắn Bearer vào ApiClient. |
| `mappers/user_mapper.dart` | `UserMapper.fromJson` (`/auth/me` → `AppUser`). |
| `mappers/book_mapper.dart` | `BookMapper.fromJson` (story BE → `Book`; **`Book.id` = slug**) + `formatCount` (12.3M / 5.3K). |
| `mappers/chapter_mapper.dart` | `ChapterMapper.fromJson` (chương BE → `Chapter`); `accessTypeToState` (free/timed/vip/ads → free/coin/vip). |
| `mappers/song_mapper.dart` | `SongMapper.fromJson` (music row BE → `Song`; `Song.url` = `audioUrl`). |

## Pattern
```
Screen/Notifier → Repository → ApiClient → backend
                     │
                     └─ Mapper (JSON → model UI)
```
- Repository trả model UI thuần (`Book`, …) + kiểu phân trang (`PagedBooks`) — UI không thấy JSON.
- Mapper chịu mọi khác biệt field giữa BE và model (vd `thumbnailUrl`→`cover`, `author.name`→`author`).

## Mở rộng (chưa làm — theo cùng pattern)
- `music_repository.dart` (`/music`, map sang `Song`/`Chart`; `url`→proxy/HLS).
- `auth_repository.dart` (`/auth/*`, token → secure storage).
- `billing_repository.dart` (coin packs/membership — Pulse/VND).
- Cache (hive + TTL, stale-while-revalidate) bọc trong repository. Xem [docs/06 §3.3](../../docs/06-cache-va-tai-nguyen.md).
