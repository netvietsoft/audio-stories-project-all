# Hướng dẫn cài đặt hệ thống thanh toán

## 1. Cấu hình biến môi trường

Thêm các biến sau vào file `.env`:

```env
# Payment Configuration
FRONTEND_URL=http://localhost:3001

# VietQR Configuration
VIETQR_BANK_ID=970422
VIETQR_ACCOUNT_NO=0123456789
VIETQR_ACCOUNT_NAME=NGUYEN VAN A
VIETQR_TEMPLATE=compact2

# Casso Webhook (for VietQR auto-confirmation)
CASSO_SECURE_TOKEN=your-casso-secure-token

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id

# Exchange Rate
USD_TO_VND_RATE=25000
```

## 2. Chạy migration

```bash
npx prisma migrate dev
npx prisma generate
```

## 3. API Endpoints

### VietQR
- `POST /billing/vietqr/create-order` - Tạo đơn hàng VietQR
- `GET /billing/vietqr/order/:orderId/status` - Kiểm tra trạng thái đơn hàng
- `POST /billing/webhook/casso` - Webhook từ Casso (auto-confirm)

### Stripe
- `POST /billing/create-checkout-session` - Tạo checkout session
- `POST /billing/webhook/stripe` - Webhook từ Stripe

### PayPal
- `POST /billing/paypal/create-order` - Tạo đơn hàng PayPal
- `POST /billing/paypal/capture-order` - Capture payment
- `POST /billing/paypal/webhook` - Webhook từ PayPal

## 4. Webhook URLs cần đăng ký

### Stripe
URL: `https://yourdomain.com/billing/webhook/stripe`

Các events cần subscribe:
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

### Casso (VietQR)
URL: `https://yourdomain.com/billing/webhook/casso`

Cấu hình:
1. Đăng ký tài khoản tại https://casso.vn
2. Liên kết tài khoản ngân hàng
3. Thêm webhook URL và secure token

### PayPal
URL: `https://yourdomain.com/billing/paypal/webhook`

Các events cần subscribe:
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`

## 5. Test thanh toán

### VietQR (Local)
```bash
curl -X POST http://localhost:3000/billing/vietqr/create-order \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"package_code": "BASIC"}'
```

### Stripe (Test mode)
Sử dụng test cards:
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002

### PayPal (Sandbox)
Tạo sandbox accounts tại: https://developer.paypal.com/dashboard/accounts

## 6. Lưu ý

1. **VietQR**: Cần đăng ký Casso để tự động xác nhận thanh toán
2. **Stripe**: Cần verify domain và cấu hình webhook secret
3. **PayPal**: Cần tạo app và lấy credentials từ developer dashboard
4. **Exchange Rate**: Cập nhật tỷ giá USD_TO_VND_RATE thường xuyên

## 7. Troubleshooting

### Webhook không hoạt động
- Kiểm tra webhook URL có public không
- Verify webhook secret đúng
- Check logs trong dashboard của provider

### Payment không được xác nhận
- Kiểm tra database có record payment không
- Check webhook events table
- Verify user credits có tăng không

### QR Code không hiển thị
- Kiểm tra VIETQR_* environment variables
- Test VietQR API: https://img.vietqr.io/
