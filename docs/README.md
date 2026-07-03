# Tài liệu dự án audio-stories

Index tài liệu kỹ thuật cho monorepo **audio-stories-project-all**
(BE NestJS + FE Next.js). Trước khi đọc bất kỳ doc nào, hãy đọc
[`../first_readme.txt`](../first_readme.txt) — file ngữ cảnh tổng (chạy local,
những điều phải nhớ, danh sách lỗi cần refactor, quy trình làm việc).

> **Lưu ý chung:** BE **không** có global prefix `/api` — route trong code là
> route thật. BE bọc mọi response trong `{ data, meta }`. Khi tài liệu mâu
> thuẫn với code → **tin code**.

## Bảng tài liệu

| File | Nội dung |
|------|----------|
| [01-kien-truc.md](01-kien-truc.md) | Kiến trúc & bootstrap BE: 3 vai api/worker/scheduler qua `APP_ROLE`, `ApiResponseInterceptor` wrap `{data,meta}`, `GlobalExceptionFilter`, config Zod, throttler, health `/healthz` `/readyz`. |
| [02-be-auth-users.md](02-be-auth-users.md) | Auth (JWT access 15m + refresh 30d, argon2, Google OAuth) + Users + RBAC (1 user = 1 Role, permissions JSON). Nhiều vấn đề bảo mật. |
| [02-be-stories-chapters.md](02-be-stories-chapters.md) | Stories, chapters, chapter-variants (truyện tương tác), categories, authors, languages; 3 đường mở khoá; proxy audio 302. |
| [02-be-music.md](02-be-music.md) | Music (single/podcast/playlist) + personal-playlist + reviews (cho Story) + comments + chapter-comments. |
| [02-be-other-modules.md](02-be-other-modules.md) | notifications, tracking (Redis buffer + cron flush), ads, banners, settings, stats, user-features (god-service), social-links. |
| [04-database.md](04-database.md) | Prisma schema (~40 model, ~20 enum) 1 file ~1173 dòng; enum là nguồn sự thật về status; đổi tên Credit→Pulse còn dở (cột DB tên cũ). |
| [05-integrations-webhooks.md](05-integrations-webhooks.md) | Billing: Stripe + VietQR/Casso webhook, packages (JSON trong site_settings), membership, transactions, upload R2/UploadThing, mail/SMTP, env. |
| [03-frontend-web.md](03-frontend-web.md) | apps/web (cổng 3001): App Router `[lang]`, Axios apiClient + BFF, auth (access localStorage + refresh HttpOnly), cạm bẫy double-unwrap `{data}`. |
| [03-frontend-admin-packages.md](03-frontend-admin-packages.md) | apps/admin (cổng 3002) + packages shared/ui/api-client; 3 hệ auth song song; di sản web còn sót. |
| [07-quy-tac-code.md](07-quy-tac-code.md) | Quy tắc bắt buộc trước khi sửa + 20 cạm bẫy + 16 lỗi cấu trúc xếp ưu tiên + checklist commit. |
| [08-api-list.md](08-api-list.md) | Danh sách ~180 endpoint BE (nhóm theo module, luồng công khai FE hay gọi, ghi chú phân quyền). Trích từ controllers. |
| [09-audio-pipeline.md](09-audio-pipeline.md) | Luồng audio: upload→R2→DB→serve 302→FE phát; preload; HLS/m3u8 (CHƯA có); điểm cắm server Python ngoài (InternalApiKeyGuard + r2AudioUrl); cấu hình R2/Cloudflare; bản đồ file. |
| [10-mobile-api.md](10-mobile-api.md) | **Hợp đồng API cho app mobile Flutter** (`../../novelverse`): base URL theo môi trường (dev/VPS), envelope `{data,meta}`, auth (Bearer + refresh header), danh sách endpoint mobile dùng (ánh xạ `lib/api/api_endpoints.dart`), quy ước Pulse/audio. |

## Tài liệu phụ trợ (superpowers)

| Thư mục | Nội dung |
|---------|----------|
| [superpowers/specs/](superpowers/specs/) | Thiết kế refactor BE (`*-be-refactor-design.md`) và tách FE moonrepo. |
| [superpowers/plans/](superpowers/plans/) | Kế hoạch theo phase (tách FE full-separation, refactor BE foundation...). |
| [superpowers/repro/](superpowers/repro/) | Baseline / repro để đối chiếu khi refactor. |

> Mỗi module BE/FE còn có `README.md` riêng trong thư mục `src` của nó — xem
> cuối từng doc vùng để biết danh sách README đã viết.
