# 03 — State & Store (NovelVerse Flutter)

> State toàn cục nằm ở **`lib/state/app_state.dart`** (1 lớp `AppState`). State tải theo
> từng màn (list/detail) tách ra notifier riêng (`stories_notifier`, `music_notifier`,
> `auth_notifier`) + `AsyncValue`. Dựa trên code thật. Cập nhật: 2026-07-02.

═══════════════════════════════════════════════════════════════════════
## 1. MÔ HÌNH: 1 STORE — `provider` + `ChangeNotifier`
═══════════════════════════════════════════════════════════════════════

- Một instance `AppState extends ChangeNotifier`, tạo (đã `init()`) ở `main.dart` rồi
  inject qua `ChangeNotifierProvider.value` trong `MultiProvider`.
- Không Redux / BLoC / Riverpod. Mọi màn đọc/ghi state qua `provider`.
- Quy tắc vàng: **state chia sẻ giữa nhiều màn → để ở `AppState`. State chỉ của một
  màn (vd controller TextField, rating tạm trong sheet) → `setState`/`StatefulBuilder`
  cục bộ.** (Ví dụ: `showRatingSheet`'s `rating`.) Lưu ý: **index tab từng là cục bộ nhưng
  đã chuyển lên `AppState.shellTab`** vì màn đẩy (Reader…) cần điều hướng về đúng tab —
  đúng tinh thần quy tắc: cần chia sẻ thì lên store.

═══════════════════════════════════════════════════════════════════════
## 2. NỘI DUNG `AppState`
═══════════════════════════════════════════════════════════════════════

| Nhóm | Field / getter | Method | Ghi chú |
|---|---|---|---|
| **Theme** | `themeMode`, `isDark` | `toggleTheme()` | điều khiển `MaterialApp.themeMode`. |
| **Chế độ** | `mode` (`AppMode.novel/audio`) | `setMode(m)` | trục Novel/Audio (xem [01 §5](01-kien-truc.md)). |
| **Ngôn ngữ** | `contentLang` (=`en`), `uiLang` (=`vi`) | `setContentLang(l)`, `setUiLang(l)` | **contentLang** = lọc nội dung qua param API `lang`; **uiLang** = `Locale` i18n. Độc lập (xem [07 §4c](07-noi-backend.md)). |
| **Tab shell** | `shellTab` (0..3) | `setShellTab(i)` | tab đang chọn ở `AppShell` (giữ ở store để màn đẩy như Reader điều hướng về đúng tab). |
| **Tiền ảo / VIP** | `coins` (=320), `streak` (=6), `vip` (=true) | `spendCoins(n)→bool`, `addCoins(n)` | `spendCoins` trả `false` nếu thiếu (UI hiện snackbar). |
| **Mở khoá chương** | `_unlocked` (Set "bookId:n") | `isUnlocked(id,n)`, `unlockChapter(id,n)` | key dạng `"$bookId:$n"`. |
| **Yêu thích nhạc** | `_likedSongs` (Set title), `likedSongs` (lọc Demo) | `isLiked(title)`, `toggleLike(title)` | dùng **title** làm khoá (prototype). |
| **Continue Reading** | `lastReadBookId/Title/Cover/ChapterTitle`, `lastReadChapter/Total`, `hasLastRead` | `setLastRead(...)` | chương đọc gần nhất (dữ liệu THẬT, Home hiện "Continue Reading"); persist. |
| **Now playing + hàng đợi** | `nowPlayingTitle/Author/Cover`, `playing`, `position`, `duration`, `buffered`, `_queue`, `_playlistMode`, `tokenProvider` | `playSong`, `play`, `togglePlay`, `next`, `prev`, `seek`, `stop` | phát thật qua **`just_audio`** (HLS + cache MP3 + playlist preload; `buffered` vẽ thanh đệm). |

⚠ **Giá trị khởi tạo là demo** (`coins=320`, `vip=true`…). Khi nối backend, các giá
trị này phải nạp từ API user (`/auth/me` → `AuthNotifier`; xem [07](07-noi-backend.md)).

═══════════════════════════════════════════════════════════════════════
## 3. PATTERN HIỆU NĂNG: `ValueNotifier` cho dữ liệu tần suất cao
═══════════════════════════════════════════════════════════════════════

Đây là điểm thiết kế quan trọng nhất của store — **đừng phá vỡ**:

- Vị trí phát (`position`) đổi ~5 lần/giây. Nếu gọi `notifyListeners()` mỗi tick →
  rebuild toàn bộ widget đang `watch` → giật.
- Giải pháp: `position` và `duration` là **`ValueNotifier<Duration>`**, KHÔNG đi qua
  `notifyListeners`. Chỉ widget cần (slider, đồng hồ thời gian) bọc
  **`ValueListenableBuilder`** để rebuild riêng phần đó.
- Thay đổi **tần suất thấp** (play/pause, đổi bài, like, coin) mới `notifyListeners()`.

```dart
// ĐÚNG: chỉ slider rebuild theo tick
ValueListenableBuilder<Duration>(
  valueListenable: app.position,
  builder: (_, pos, __) => Slider(value: pos.inSeconds.toDouble(), ...),
)
```

═══════════════════════════════════════════════════════════════════════
## 4. ĐỌC STATE ĐÚNG CÁCH (select / watch / read)
═══════════════════════════════════════════════════════════════════════

| Cách | Khi nào | Ví dụ trong code |
|---|---|---|
| `context.select<AppState,T>((a)=>a.x)` | Chỉ muốn rebuild khi **một** giá trị đổi | `app_shell.dart`: `select(mode)`, `select(nowPlayingTitle != null)` → shell KHÔNG rebuild theo tick phát. |
| `context.watch<AppState>()` | Cần nhiều field, chấp nhận rebuild khi bất kỳ field nào đổi | `_MiniPlayer` (đổi ít). |
| `context.read<AppState>()` | Chỉ gọi method, KHÔNG cần rebuild (trong callback) | `sheets.dart`: `context.read<AppState>()` rồi `spendCoins`. |

> Mẹo: trong handler `onTap`/`onPressed` luôn dùng `read` (không `watch`) để tránh
> đăng ký rebuild thừa.

═══════════════════════════════════════════════════════════════════════
## 5. VÒNG ĐỜI & DỌN DẸP
═══════════════════════════════════════════════════════════════════════

`AppState.dispose()` giải phóng: `_player.dispose()`, `position.dispose()`,
`duration.dispose()`, `buffered.dispose()`. Vì store sống suốt vòng đời app (tạo ở gốc),
`dispose` chỉ chạy khi app thoát — nhưng vẫn khai báo đúng để không rò khi cấu trúc thay đổi.

Listener của player (`just_audio`) đăng ký **một lần** trong constructor:
`positionStream`, `durationStream`, `bufferedPositionStream`, `playerStateStream`
(hết bài ở chế độ 1 nguồn → reset), `currentIndexStream` (playlist tự sang bài → cập nhật metadata).

═══════════════════════════════════════════════════════════════════════
## 6. LƯU TRỮ BỀN (PERSIST) — ĐÃ CÓ (`shared_preferences`)
═══════════════════════════════════════════════════════════════════════

State do **người dùng** đổi nay được lưu qua `shared_preferences` (dep trong
`pubspec.yaml`) → còn nguyên sau khi tắt/mở lại app.

**Cơ chế** (`app_state.dart`):
- `AppState.init()` (async) đọc các khoá đã lưu, gán vào field rồi `notifyListeners()`.
- Gọi **một lần trong `main()` trước `runApp`** (`await appState.init()`), và inject qua
  `ChangeNotifierProvider.value` → theme/mode/coin đúng **ngay frame đầu**, không nháy
  giá trị mặc định. (`main()` đã `WidgetsFlutterBinding.ensureInitialized()` để gọi plugin.)
- Mỗi mutation ghi lại khoá tương ứng (fire-and-forget, `_prefs?.set...`).

**Khoá lưu:**

| Khoá | Field | Kiểu | Ghi ở |
|---|---|---|---|
| `themeMode` | `themeMode` | String `light`/`dark` | `toggleTheme` |
| `mode` | `mode` | String `novel`/`audio` | `setMode` |
| `contentLang` | `contentLang` | String (`en`/`vi`…) | `setContentLang` |
| `uiLang` | `uiLang` | String (`vi`/`en`…) | `setUiLang` |
| `coins` | `coins` | int | `spendCoins`/`addCoins` |
| `likedSongs` | `_likedSongs` | List&lt;String&gt; (title) | `toggleLike` |
| `unlocked` | `_unlocked` | List&lt;String&gt; (`bookId:n`) | `unlockChapter` |
| `lastRead` | `lastRead*` | String (JSON) | `setLastRead` |

**KHÔNG persist** (cố ý): `streak`, `vip` (cờ demo → backend quyết định khi online);
`nowPlaying*`/`position` (phiên phát). API public của `AppState` giữ nguyên — màn hình
không phải sửa.

**Còn lại (khi nối backend — chưa làm):**
1. **Token đăng nhập** → **`flutter_secure_storage`** (KeyStore/Keychain), KHÔNG dùng
   `shared_preferences`.
2. **Dữ liệu lớn/đồng bộ** (lịch sử nghe, vị trí đang nghe, cache list) → cân nhắc
   `hive`/`isar` nếu vượt quy mô vài set string.
3. **Nguồn sự thật khi online**: coin/VIP/unlocked thật ở backend (Pulse, membership,
   user_chapter_unlocks). Local chỉ là cache/offline mirror — đồng bộ khi mở app và sau
   mỗi giao dịch. Xem [07](07-noi-backend.md).
