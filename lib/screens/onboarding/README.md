# `lib/screens/onboarding/` — Onboarding

Luồng giới thiệu lần đầu (UI prototype).

## File
| File | Màn | Route |
|---|---|---|
| `onboarding_screen.dart` | `OnboardingScreen` — `PageView` 5 bước | `/onboarding` |

## 5 bước (PageView)
1. **Language** — chọn ngôn ngữ (multi-select chip).
2. **Welcome** — logo + nút đăng nhập (Google/Apple/Email/Guest — tĩnh).
3. **Genre** — chọn thể loại (`Demo.genres`, "chọn ≥3 +50 coins").
4. **Reward** — lịch thưởng 7 ngày.
5. **Paywall** — chọn gói VIP (`Demo.plans`).

Dots chỉ báo bước; nút **Continue/Get Started**; **Skip** → `/home`. Bước cuối → `context.go('/home')`.

## Ghi chú
- ⚠ Hiện **không nằm trong boot flow mặc định** (splash đi thẳng `/home`). Vào từ Profile →
  "Replay onboarding" (`/onboarding`). Khi có auth thật, splash/gate sẽ quyết định hiện onboarding hay không ([docs/04 §4](../../../docs/04-routing-va-loading.md)).
- State bước là cục bộ (`StatefulWidget`), chưa lưu lựa chọn (ngôn ngữ/genre/plan) — nối backend mới persist.
