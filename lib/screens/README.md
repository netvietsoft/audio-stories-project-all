# `lib/screens/` — Màn hình (theo feature)

UI tổ chức theo vùng nghiệp vụ. Điều hướng khai ở [`../router.dart`](../router.dart)
(xem [docs/04](../../docs/04-routing-va-loading.md)).

## File dùng chung (cả 2 chế độ)
| File | Vai trò | Route |
|---|---|---|
| `splash_screen.dart` | Splash: logo + spinner, `Timer 1100ms` → `/home`. Delay thương hiệu (chưa chờ async). | `/` |
| `app_shell.dart` | **Khung chính**: `IndexedStack` 4 tab theo `mode` + bottom nav (đổi nhãn/màu) + `_MiniPlayer` toàn cục. Chứa `_BottomNav`, `_MiniPlayer` (private). | `/home` |
| `profile_screen.dart` | Tab Profile: avatar/VIP, coin + Top up/VIP, danh sách cài đặt (→ account), toggle dark theme, replay onboarding. | tab |

## Thư mục con
| Folder | Chế độ/vùng | README |
|---|---|---|
| `novel/` | Đọc truyện (Home/Discover/Trending/BookDetail/Reader) | [novel/README.md](novel/README.md) |
| `audio/` | Nghe (Home/Library/Charts/Album/Player/Audiobook/Favourites) | [audio/README.md](audio/README.md) |
| `money/` | Coin/VIP/Ví (CoinStore/Subscription/Wallet) | [money/README.md](money/README.md) |
| `account/` | Màn tài khoản phụ (Edit/Language/Content/Copyright/Author) | [account/README.md](account/README.md) |
| `onboarding/` | Onboarding 5 bước | [onboarding/README.md](onboarding/README.md) |
| `auth/` | Đăng nhập (login) | [auth/README.md](auth/README.md) |

## Quy ước màn hình
- 1 file = 1 màn (trừ `account_screens.dart` gộp các màn nhỏ; widget cục bộ để private).
- `Scaffold(backgroundColor: pal.bg)` + `SafeArea` cho tab; màn chi tiết dùng `AppBar` + `context.pop()`.
- Dữ liệu từ `Demo.*`; đọc state qua provider (`watch/select/read`).
- Tab trong `/home` KHÔNG phải route — là `_index` cục bộ của `AppShell`. Màn chi tiết mới `context.push`.
