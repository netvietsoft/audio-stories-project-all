# Stripe Webhook Setup Guide

## ✅ Implementation Status

Stripe webhook đã được implement đầy đủ với các tính năng:

### 1. Controller & Routes
- **Endpoint**: `POST /billing/webhook/stripe`
- **Raw body parser**: ✅ Đã config trong `main.ts`
- **Signature verification**: ✅ Sử dụng `stripe.webhooks.constructEvent()`

### 2. Event Handling
Các event được xử lý:
- ✅ `checkout.session.completed` - Thanh toán hoàn tất
- ✅ `payment_intent.succeeded` - Payment thành công
- ✅ `payment_intent.payment_failed` - Payment thất bại

### 3. Checkout Completed Flow
Khi nhận event `checkout.session.completed`:
1. ✅ Lấy `user_id` và `package_code` từ metadata
2. ✅ Tìm package theo code
3. ✅ Kiểm tra duplicate payment (tránh xử lý 2 lần)
4. ✅ Tạo payment record trong database
5. ✅ Cộng credits cho user
6. ✅ Tạo credit transaction history
7. ✅ Gửi notification cho user
8. ✅ Gửi email xác nhận (nếu user cho phép)
9. ✅ Sử dụng transaction để đảm bảo data consistency

### 4. Security
- ✅ Webhook signature verification
- ✅ Environment variable `STRIPE_WEBHOOK_SECRET` đã được set
- ✅ Raw body parser chỉ áp dụng cho webhook route

### 5. Logging & Monitoring
- ✅ Log đầy đủ các bước xử lý
- ✅ Log error khi có vấn đề
- ✅ Lưu webhook events vào database (bảng `webhookEvent`)

---

## 🧪 Testing Webhook

### Option 1: Stripe CLI (Recommended for local testing)

1. **Install Stripe CLI**
   ```bash
   # Windows (using Scoop)
   scoop install stripe
   
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Linux
   # Download from https://github.com/stripe/stripe-cli/releases
   ```

2. **Login to Stripe**
   ```bash
   stripe login
   ```

3. **Forward webhooks to local server**
   ```bash
   stripe listen --forward-to localhost:3000/billing/webhook/stripe
   ```
   
   Lệnh này sẽ:
   - Tạo webhook signing secret (whsec_...)
   - Forward tất cả Stripe events đến local server
   - Hiển thị webhook secret để update vào `.env`

4. **Trigger test events**
   ```bash
   # Test checkout.session.completed
   stripe trigger checkout.session.completed
   
   # Test payment_intent.succeeded
   stripe trigger payment_intent.succeeded
   
   # Test payment_intent.payment_failed
   stripe trigger payment_intent.payment_failed
   ```

### Option 2: Stripe Dashboard (For production testing)

1. **Tạo webhook endpoint trong Stripe Dashboard**
   - Vào https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - URL: `https://your-domain.com/billing/webhook/stripe`
   - Select events:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

2. **Copy webhook signing secret**
   - Sau khi tạo endpoint, copy webhook signing secret (whsec_...)
   - Update vào `.env.prod`:
     ```
     STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
     ```

3. **Test bằng cách tạo payment thật**
   - Tạo checkout session từ frontend
   - Hoàn tất thanh toán
   - Kiểm tra logs trong Stripe Dashboard > Webhooks > Events

### Option 3: Manual Testing với cURL

```bash
# Lấy sample event từ Stripe
stripe events list --limit 1

# Gửi webhook manually (cần có valid signature)
curl -X POST http://localhost:3000/billing/webhook/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=timestamp,v1=signature" \
  -d @webhook_payload.json
```

---

## 🔍 Debugging

### Check logs
```bash
# Backend logs sẽ hiển thị:
# - "Processing Stripe event: checkout.session.completed"
# - "Checkout completed - User ID: xxx, Package: xxx"
# - "Payment transaction completed successfully"
```

### Check database
```sql
-- Kiểm tra webhook events
SELECT * FROM webhook_event WHERE provider = 'stripe' ORDER BY created_at DESC LIMIT 10;

-- Kiểm tra payments
SELECT * FROM payment WHERE provider_payment_id LIKE 'cs_%' ORDER BY created_at DESC LIMIT 10;

-- Kiểm tra credit transactions
SELECT * FROM credit_transaction WHERE type = 'topup' ORDER BY created_at DESC LIMIT 10;
```

### Common Issues

1. **"No raw body" error**
   - ✅ Fixed: Raw body parser đã được config trong `main.ts`

2. **"Stripe webhook secret not configured"**
   - Check `.env` file có `STRIPE_WEBHOOK_SECRET`
   - Restart server sau khi update env

3. **"Webhook signature verification failed"**
   - Đảm bảo webhook secret đúng
   - Kiểm tra raw body parser hoạt động
   - Với Stripe CLI, dùng secret từ `stripe listen` output

4. **"Payment already processed"**
   - Đây là behavior mong muốn để tránh duplicate
   - Webhook có thể được gửi nhiều lần

---

## 📝 Environment Variables

Đảm bảo các biến sau được set trong `.env`:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Exchange Rate (for USD to VND conversion)
USD_TO_VND_RATE=26283
```

---

## 🚀 Production Checklist

- [ ] Update `STRIPE_SECRET_KEY` với production key (sk_live_...)
- [ ] Tạo production webhook endpoint trong Stripe Dashboard
- [ ] Update `STRIPE_WEBHOOK_SECRET` với production secret
- [ ] Test webhook với real payment
- [ ] Monitor webhook events trong Stripe Dashboard
- [ ] Setup alerting cho failed webhooks
- [ ] Backup webhook events từ database định kỳ

---

## 📚 References

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
