# `lib/data/` — Tầng dữ liệu (repository + mapper)

Trung gian giữa `api/` (API thô) và UI: trả **model UI** (`lib/models`), ẩn
envelope/endpoint. Tài liệu: [docs/07](../../docs/07-noi-backend.md).

## Cấu trúc
| File | Vai trò |
|---|---|
| `repositories/stories_repository.dart` | `StoriesRepository`: `explore()` → `PagedBooks`; `detail(slug)` → `StoryDetail{book, chapters}`; `chapterContent(id)` → `ChapterContent`; `bySlug(slug)` → `Book`. Cũng khai báo `TimingCue` + `activeCueIndex()` (read-along, xem bên dưới). `recommended()`/`trending()` (+`cachedRecommended`/`cachedTrending`) cho Novel Home. |
| `repositories/categories_repository.dart` | `getCategories(lang)` + `topCategories(limit,lang)` (kệ Home) + bản `cached*` đồng bộ. |
| `repositories/comments_repository.dart` | `ChapterComment`/`CommentPage` + `paragraphAll`/`chapterPage`/`replies`/`create`/`toggleReaction`/`report` (module chapter-comments BE). |
| `comments/paragraph_anchor.dart` | `makeAnchor` (đồng nhất web) + `matchCommentsToParagraphs` (anchor-first, index-fallback). |
| `repositories/music_repository.dart` | `MusicRepository.list({page,limit,search})` → `List<Song>`. |
| `repositories/audio_repository.dart` | `AudioRepository.chapterAudioUrl(id)` — resolve `/chapters/:id/audio` (302, kèm Bearer) → URL audio thật để phát. |
| `share_links.dart` | `buildChapterWebUrl(slug, n)` — link web chương cho nút Share (`ApiEnv.webBaseUrl`). |
| `repositories/auth_repository.dart` | `AuthRepository`: login/verifyCode/me/refresh/logout/changePassword/restoreSession. Đọc refresh từ Set-Cookie, lưu qua `TokenStore` (secure storage), gắn Bearer vào ApiClient. |
| `repositories/banners_repository.dart` | `BannersRepository.list({lang='vi'})` → `List<AppBanner>` (`GET /banners?lang=`, bảng HeroBanner BE); `AppBanner`: `id, title, imageUrl, targetUrl, storySlug` — banner carousel ở Home (storySlug → mở in-app, targetUrl → trình duyệt). |
| `repositories/history_repository.dart` | `HistoryRepository`: `sync({storyUuid, chapterId, progressSeconds=0})` — POST tiến độ 1 cặp story+chương mỗi lần mở chương (fire-and-forget); `list({limit=50})` → GET lịch sử từ BE (`RemoteHistoryEntry`, merge với local). |
| `reader/reader_store.dart` | `ReaderStore`: đọc/ghi settings đọc + resume + bookmark + brightness + read-along toggle (`readReadAlong()`/`saveReadAlong()`, xem bên dưới), qua `shared_preferences`. |
| `reading_history/reading_history_store.dart` | `ReadingHistoryStore`: Hive box `readingHistory` (50 truyện gần nhất, truncate oldest); `upsert(story)` ghi khi mở chương; `truncateWords(text, 20)` rút ngắn summary; `mergeHistory(local, remote)` merge 2 chiều (bên mới hơn thắng). |
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

## Read-along (Spec 2)

Timing cue cho tính năng highlight câu đang đọc + auto-scroll, đồng bộ với audio đang phát.

- `TimingCue` (`repositories/stories_repository.dart`): `{startMs, endMs, paraIndex, charStart, charEnd}`.
  `TimingCue.fromMap(Map m)` đọc key rút gọn từ BE: `s`→startMs, `e`→endMs, `p`→paraIndex (mặc định
  `-1` nếu thiếu/không phải số), `cs`→charStart, `ce`→charEnd.
- `activeCueIndex(List<TimingCue> cues, int posMs)` (hàm top-level, cùng file): trả về index cue có
  `startMs <= posMs < endMs`, hoặc `null` nếu không khớp cue nào. Giả định `cues` đã sắp theo `startMs`.
- `ChapterContent.cues` (`List<TimingCue>`, mặc định `const []`): nhánh **online** parse từ field
  `timing` của API chương và auto-cache vào `OfflineChapter.cues`; nhánh **offline/local-first**
  đọc từ `OfflineChapter.cues` đã lưu (read-along chạy cả offline). Mở chương đã tải lúc online →
  SWR: trả local ngay + `_refreshInBackground` cập nhật content+cues cho lần mở sau.
- `reader/reader_store.dart`: `readReadAlong()` (đọc bool, mặc định `false`) + `saveReadAlong(bool)`,
  key `reader.readalong` trong `shared_preferences` — cùng pattern với `reader.brightness`.

## Mở rộng (chưa làm — theo cùng pattern)
- `music_repository.dart` (`/music`, map sang `Song`/`Chart`; `url`→proxy/HLS).
- `auth_repository.dart` (`/auth/*`, token → secure storage).
- `billing_repository.dart` (coin packs/membership — Pulse/VND).
- Cache (hive + TTL, stale-while-revalidate) bọc trong repository. Xem [docs/06 §3.3](../../docs/06-cache-va-tai-nguyen.md).
