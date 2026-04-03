# Hướng dẫn sử dụng Custom Head Scripts

## Tính năng

Tính năng Custom Head Scripts cho phép bạn thêm các đoạn JavaScript, CSS, meta tags hoặc bất kỳ HTML code nào vào thẻ `<head>` của toàn bộ website.

## Cách sử dụng

### 1. Truy cập Admin Settings

- Đăng nhập vào Admin Panel
- Vào menu **Settings** (Cài đặt Hệ thống)
- Tìm section **Custom Head Scripts**

### 2. Thêm Scripts

Paste toàn bộ code vào textarea. Ví dụ:

#### Google Analytics 4

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

#### Facebook Pixel

```html
<!-- Facebook Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
       src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"/>
</noscript>
```

#### Google Tag Manager

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
<!-- End Google Tag Manager -->
```

#### Custom CSS

```html
<style>
  /* Custom styles */
  body {
    font-family: 'Your Custom Font', sans-serif;
  }
</style>
```

#### Meta Tags

```html
<meta name="facebook-domain-verification" content="xxxxxxxxxxxxxxxxxx" />
<meta name="google-site-verification" content="xxxxxxxxxxxxxxxxxx" />
```

### 3. Lưu thay đổi

- Click nút **"Lưu Scripts"**
- Scripts sẽ được áp dụng ngay lập tức cho toàn bộ website

## Lưu ý quan trọng

⚠️ **Bảo mật**: Chỉ paste code từ các nguồn đáng tin cậy. Code độc hại có thể ảnh hưởng đến toàn bộ website.

⚠️ **Hiệu suất**: Quá nhiều scripts có thể làm chậm tốc độ tải trang.

⚠️ **Kiểm tra**: Sau khi lưu, hãy kiểm tra website để đảm bảo mọi thứ hoạt động bình thường.

## Cách hoạt động

1. Scripts được lưu trong database (bảng `site_settings`, key: `custom_head_scripts`)
2. Frontend fetch scripts từ API endpoint `/settings/site`
3. Scripts được inject vào `<head>` tag khi trang load
4. Scripts chạy trên tất cả các trang của website

## Troubleshooting

### Scripts không hoạt động?

1. Kiểm tra Console (F12) xem có lỗi JavaScript không
2. Đảm bảo syntax của scripts đúng
3. Kiểm tra xem scripts có được inject vào `<head>` không (View Page Source)

### Muốn xóa scripts?

1. Vào Admin Settings
2. Xóa toàn bộ nội dung trong textarea
3. Click "Lưu Scripts"

## API Endpoint

- **GET** `/settings/site` - Lấy public settings (bao gồm custom_head_scripts)
- **PATCH** `/settings/bulk` - Cập nhật settings (Admin only)

## Database

```sql
-- Xem custom scripts hiện tại
SELECT * FROM site_settings WHERE `key` = 'custom_head_scripts';

-- Cập nhật thủ công (nếu cần)
UPDATE site_settings 
SET `value` = 'your_scripts_here' 
WHERE `key` = 'custom_head_scripts';
```
