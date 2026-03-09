# Hướng dẫn khởi động nhanh hệ thống thanh toán

## 1. Khởi động Backend

```bash
cd be
npm run start:dev
```

Backend sẽ chạy tại: http://localhost:3000

## 2. Khởi động Frontend

```bash
cd fe
yarn dev
```

Frontend sẽ chạy tại: http://localhost:3001

## 3. Đăng nhập Admin

- URL: http://localhost:3001/admin/login
- Email: `admin@truyen-audio.app`
- Password: `admin123`

## 4. Test thanh toán

### Bước 1: Đăng nhập user thường
- Đăng ký tài khoản mới tại: http://localhost:3001/register
- Hoặc đăng nhập với Google

### Bước 2: Truy cập trang nạp credits
- URL: http://localhost:3001/topup
- Chọn gói credits
- Chọn phương thức thanh toán

### Bước 3: Test từng phương thức

#### VietQR (Chuyển khoản ngân hàng)
1. Chọn phương thức "VietQR"
2. Click "Thanh toán ngay"
3. Sẽ hiển thị QR code và thông tin chuyển khoản
4. Copy nội dung chuyển khoản
5. Chuyển khoản qua app ngân hàng
6. Webhook từ Casso sẽ tự động xác nhận (nếu đã cấu hình)

#### Stripe (Thẻ quốc tế)
1. Chọn phương thức "Thẻ quốc tế"
2. Click "Thanh toán ngay"
3. Sẽ redirect đến Stripe Checkout
4. Sử dụng test card: `4242 4242 4242 4242`
5. Expiry: bất kỳ (tương lai)
6. CVC: bất kỳ 3 số
7. Hoàn tất thanh toán

#### PayPal
1. Chọn phương thức "PayPal"
2. Click "Thanh toán ngay"
3. Sẽ redirect đến PayPal
4. Đăng nhập PayPal sandbox account
5. Hoàn tất thanh toán

## 5. Kiểm tra kết quả

### Kiểm tra credits
- Vào profile: http://localhost:3001/profile
- Xem số credits đã tăng

### Kiểm tra lịch sử giao dịch (Admin)
- Đăng nhập admin
- Vào: http://localhost:3001/admin/transactions
- Xem danh sách payments

### Kiểm tra database
```bash
cd be
npx prisma studio
```

Xem bảng:
- `payments` - Danh sách thanh toán
- `credit_transactions` - Lịch sử credits
- `users` - Credits của user

## 6. Cấu hình môi trường (Production)

### VietQR
1. Đăng ký tài khoản Casso: https://casso.vn
2. Liên kết tài khoản ngân hàng
3. Lấy thông tin:
   - VIETQR_BANK_ID (Mã ngân hàng)
   - VIETQR_ACCOUNT_NO (Số tài khoản)
   - VIETQR_ACCOUNT_NAME (Tên chủ tài khoản)
4. Cấu hình webhook:
   - URL: `https://yourdomain.com/billing/webhook/casso`
   - Lấy CASSO_SECURE_TOKEN

### Stripe
1. Đăng ký: https://dashboard.stripe.com/register
2. Lấy API keys:
   - STRIPE_SECRET_KEY (sk_test_... hoặc sk_live_...)
3. Cấu hình webhook:
   - URL: `https://yourdomain.com/billing/webhook/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`
   - Lấy STRIPE_WEBHOOK_SECRET

### PayPal
1. Đăng ký: https://developer.paypal.com
2. Tạo app mới
3. Lấy credentials:
   - PAYPAL_CLIENT_ID
   - PAYPAL_CLIENT_SECRET
4. Cấu hình webhook:
   - URL: `https://yourdomain.com/billing/paypal/webhook`
   - Events: `PAYMENT.CAPTURE.COMPLETED`
   - Lấy PAYPAL_WEBHOOK_ID

## 7. Troubleshooting

### Lỗi "Package not found"
- Chạy: `npx ts-node prisma/seed-packages.ts`

### Lỗi "User not found"
- Đảm bảo đã đăng nhập
- Check JWT token trong localStorage

### QR Code không hiển thị
- Kiểm tra VIETQR_* trong .env
- Test API: https://img.vietqr.io/image/970422-0123456789-compact2.png

### Webhook không hoạt động
- Sử dụng ngrok để test local: `ngrok http 3000`
- Cập nhật webhook URL với ngrok URL
- Check logs trong provider dashboard

## 8. API Testing với cURL

### Tạo VietQR order
```bash
curl -X POST http://localhost:3000/billing/vietqr/create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"package_code": "STANDARD"}'
```

### Tạo Stripe checkout
```bash
curl -X POST http://localhost:3000/billing/create-checkout-session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_code": "STANDARD",
    "provider": "STRIPE",
    "success_url": "http://localhost:3001/topup/success",
    "cancel_url": "http://localhost:3001/topup"
  }'
```

### Tạo PayPal order
```bash
curl -X POST http://localhost:3000/billing/paypal/create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"package_code": "STANDARD"}'
```

## 9. Packages có sẵn

| Code | Tên | Giá | Credits | Bonus |
|------|-----|-----|---------|-------|
| BASIC | Gói Cơ Bản | 50,000đ | 50 | 0% |
| STANDARD | Gói Tiêu Chuẩn | 100,000đ | 110 | +10% |
| PREMIUM | Gói Cao Cấp | 200,000đ | 230 | +15% |
| VIP | Gói VIP | 500,000đ | 600 | +20% |
| SUPER_VIP | Gói Siêu VIP | 1,000,000đ | 1,300 | +30% |

## 10. Thêm/Sửa packages

### Qua Admin Panel
- URL: http://localhost:3001/admin/packages
- Thêm/sửa/xóa packages

### Qua API
```bash
# Thêm package mới
curl -X POST http://localhost:3000/packages \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "MEGA",
    "name": "Gói Mega",
    "priceVnd": 2000000,
    "credits": 3000,
    "description": "Gói khủng nhất",
    "isActive": true,
    "displayOrder": 6
  }'
```

Chúc bạn test thành công! 🚀
