# `lib/api/` — Tầng kết nối backend (cấu hình tập trung)

**Mọi thứ về kết nối backend gom ở đây** để khi BE tách ra VPS chỉ cần đổi 1 chỗ
(domain/IP), không phải sửa rải rác. Tài liệu: [docs/07](../../docs/07-noi-backend.md).

## Files
| File | Vai trò |
|---|---|
| `api_env.dart` | **CHỖ ĐỔI DOMAIN/IP.** Môi trường dev/staging/prod, `baseUrl`, cờ `useBackend`, `defaultLang`. Đọc qua `--dart-define`. |
| `api_endpoints.dart` | **Tất cả path endpoint một nơi** (auth, stories, chapters, music, billing…). BE không có prefix `/api`. |
| `api_client.dart` | `ApiClient` (Dio): base URL, bóc envelope `{data,meta}`, gắn Bearer token, **tự refresh 401** (`refreshCallback`), `postRaw` (đọc Set-Cookie cho auth), map lỗi → `ApiException` + `unwrapList`. |
| `api_exception.dart` | `ApiException(code, message, status?)`. |
| `token_store.dart` | `TokenStore` — lưu access/refresh token trong `flutter_secure_storage` (Keychain/Keystore). |
| `google_auth.dart` | `GoogleAuth` — bọc `google_sign_in` v7 (`serverClientId` = `ApiEnv.googleServerClientId`), trả idToken; user hủy → null. |

## 🔧 Khi BE chuyển lên VPS — làm đúng 1 trong các cách sau
1. **Sửa code** `api_env.dart`: điền `prodBaseUrl = 'https://api.tenmien.vn'` và đặt
   `defaultEnvironment = ApiEnvironment.prod`.
2. **Không sửa code** — truyền lúc build/run:
   ```bash
   flutter run  --dart-define=USE_BACKEND=true --dart-define=API_ENV=prod
   flutter build apk --dart-define=USE_BACKEND=true --dart-define=API_BASE_URL=https://api.tenmien.vn
   ```
   `API_BASE_URL` (override trực tiếp) > `API_ENV` (chọn môi trường) > `defaultEnvironment`.

| Tình huống | baseUrl |
|---|---|
| dev, Android emulator | `http://10.0.2.2:3000` |
| dev, iOS/desktop/web | `http://localhost:3000` |
| máy thật cùng LAN | `--dart-define=API_BASE_URL=http://<ip-LAN>:3000` |
| production (VPS) | `prodBaseUrl` (đổi trong `api_env.dart`) |

## Quy ước
- UI/screen **không** gọi Dio trực tiếp → qua repository (`lib/data`) → `ApiClient`.
- Thêm/đổi route BE → sửa `api_endpoints.dart` (không hardcode string '/stories/...' nơi khác).
- Bật auth: `apiClient.accessToken = '<jwt>'` sau login (chưa nối — xem docs/07).
