# `lib/screens/money/` — Coin / VIP / Ví

Mua coin, đăng ký VIP, ví & phần thưởng. Dữ liệu gói từ `Demo.coinPacks` / `Demo.plans`.

## Files
| File | Màn | Route | Điểm chính |
|---|---|---|---|
| `coin_store_screen.dart` | Mua coin | `/coins` | Grid `Demo.coinPacks` (chọn 1, badge label/bonus), nút Buy → **snackbar demo** (chưa thanh toán thật). "Synced with your web purchases". |
| `subscription_screen.dart` | Gói VIP | `/subscription` | Danh sách perk + `Demo.plans` (chọn 1, badge Popular), nút Start → **snackbar demo**. |
| `wallet_screen.dart` | Ví & thưởng | `/wallet` | Thẻ số dư (gradient), check-in 7 ngày (`app.streak`), claim/nhiệm vụ → `app.addCoins(n)` (CỘNG THẬT vào state), lịch sử giao dịch (tĩnh). |

## State dùng
- `app.coins` (hiển thị số dư), `app.addCoins(n)` (claim/nhiệm vụ ở Wallet — cộng thật + persist),
  `app.streak`/`app.vip` (hiển thị).
- CoinStore/Subscription hiện **chỉ snackbar** (chưa trừ tiền/đặt VIP) — là điểm nối thanh toán.

## ⚠ Khi nối backend (quan trọng — tiền)
- Mua coin/VIP phải qua **backend là trọng tài** (Pulse/membership), KHÔNG tự cộng/trừ ở client
  rồi mới gọi API. Map `coins ↔ Pulse`, giá demo USD → **VND** (`priceVnd` + `pulseAmount`).
- Idempotency/chống double-credit do BE đảm bảo. Xem [docs/07 §4](../../../docs/07-noi-backend.md).
