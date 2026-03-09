# Test Billing Routes

## Bước 1: Kiểm tra Backend đang chạy

Mở terminal và chạy:
```bash
cd be
npm run start:dev
```

Đợi cho đến khi thấy:
```
[Nest] ... - Application successfully started
```

## Bước 2: Test các endpoints

### 1. Test Health Check
```bash
curl http://localhost:3000
```

Kết quả mong đợi: `Hello World!` hoặc response từ AppController

### 2. Test Get Packages (không cần auth)
```bash
curl http://localhost:3000/packages
```

Kết quả mong đợi: Array các packages

### 3. Test Login để lấy token
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@truyen-audio.app\",\"password\":\"admin123\"}"
```

Copy `access_token` từ response

### 4. Test VietQR Create Order (cần auth)
```bash
curl -X POST http://localhost:3000/billing/vietqr/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d "{\"package_code\":\"BASIC\"}"
```

Thay `YOUR_ACCESS_TOKEN` bằng token từ bước 3

## Bước 3: Kiểm tra lỗi thường gặp

### Lỗi 404 - Route không tồn tại
**Nguyên nhân:**
- Backend chưa khởi động
- BillingModule chưa được import vào AppModule
- Controller path không đúng

**Giải pháp:**
1. Kiểm tra backend đang chạy
2. Kiểm tra `be/src/app.module.ts` có import `BillingModule`
3. Restart backend

### Lỗi 401 - Unauthorized
**Nguyên nhân:**
- Chưa đăng nhập
- Token hết hạn
- Token không hợp lệ

**Giải pháp:**
1. Đăng nhập lại để lấy token mới
2. Kiểm tra header Authorization

### Lỗi 403 - Forbidden
**Nguyên nhân:**
- User không có quyền
- RolesGuard chặn

**Giải pháp:**
1. Đảm bảo user có role ADMIN (nếu endpoint yêu cầu)
2. Chạy seed lại: `npx prisma db seed`

### Lỗi 500 - Internal Server Error
**Nguyên nhân:**
- Database connection failed
- Prisma Client chưa được generate
- Code lỗi

**Giải pháp:**
1. Kiểm tra DATABASE_URL trong .env
2. Chạy: `npx prisma generate`
3. Check logs trong terminal backend

## Bước 4: Debug Frontend

Nếu backend hoạt động tốt nhưng frontend vẫn lỗi:

1. **Kiểm tra API Client config**
   - File: `fe/src/lib/api/api-client.ts`
   - Đảm bảo baseURL đúng: `http://localhost:3000`

2. **Kiểm tra CORS**
   - Backend phải cho phép origin từ frontend
   - Check `CORS` trong `be/.env`

3. **Kiểm tra Network tab**
   - Mở DevTools > Network
   - Xem request có được gửi không
   - Check status code và response

## Bước 5: Checklist hoàn chỉnh

- [ ] Backend đang chạy (port 3000)
- [ ] Frontend đang chạy (port 3001)
- [ ] Database connection OK
- [ ] Prisma Client đã generate
- [ ] BillingModule đã import vào AppModule
- [ ] Packages đã được seed
- [ ] User đã đăng nhập
- [ ] Token hợp lệ
- [ ] CORS được cấu hình đúng

## Quick Fix Commands

```bash
# Stop tất cả
# Ctrl+C trong terminal backend và frontend

# Backend
cd be
rm -rf node_modules/.prisma
npm install
npx prisma generate
npx prisma db seed
npm run start:dev

# Frontend (terminal mới)
cd fe
yarn dev
```

## Test Flow hoàn chỉnh

1. Đăng nhập: http://localhost:3001/login
2. Vào topup: http://localhost:3001/topup
3. Chọn package
4. Chọn VietQR
5. Click "Thanh toán ngay"
6. Xem QR code hiển thị

Nếu bước nào lỗi, check logs trong terminal backend!
