📖 PARAGRAPH ENGINE
Inline Comment · Ad Injection · Paywall System
Technical Design Document — DB Schema + Backend + Frontend + CMS


💬 Inline Paragraph Comments	📢 Smart Ad Injection Engine	🔒 Paywall / Subscription Gate


Tổng quan yêu cầu
• Tách nội dung truyện chữ thành từng đoạn (paragraph objects) khi đăng bài
• Mỗi đoạn có ID riêng → user có thể comment inline trên từng đoạn cụ thể
• Chèn quảng cáo thông minh: cấu hình sau N ký tự / N đoạn tự động
• Chèn CTA subscription / unlock nội dung tại vị trí cấu hình sẵn
• CMS quản lý toàn bộ: cấu hình ads, xem inline comments, moderate


Version 1.0  |  Tháng 3/2025  |  Tài liệu nội bộ — Confidential
 
  PHẦN 1: KIẾN TRÚC TỔNG QUAN & LUỒNG DỮ LIỆU

1.1  Mô hình dữ liệu mới — Sơ đồ quan hệ
📐 Quan hệ giữa các bảng
stories (1) ──────────────────── (N) chapters
                                       │
                                       │ 1
                                       ▼
                              chapter_paragraphs (N)
                                       │              │
                                 1     │              │ 1
                                 ▼     ▼              ▼
                         paragraph_inline_comments   ad_placement_logs

chapters (1) ──── (N) chapter_end_comments    ← giữ nguyên bảng cũ

site_ad_configs   ← cấu hình toàn cục (CMS)
story_ad_configs  ← override theo từng truyện (CMS)

1.2  Luồng khi Admin đăng chương (CMS → Backend → DB)
  // Luồng publish chương truyện chữ
┌─────────────────────────────────────────────────────────────────┐
│  1. Admin paste raw text vào CMS editor                         │
│  2. Admin bấm "Lưu chương"                                      │
│  3. Frontend CMS gửi POST /admin/chapters/:id/publish           │
│     Body: { textContent: "raw text với \n\n giữa các đoạn" }  │
│                                                                  │
│  4. NestJS ParagraphService.parsAndSave(chapterId, rawText)     │
│     a. Split theo \n\n → mảng string[]                         │
│     b. Filter đoạn rỗng, trim whitespace                        │
│     c. Tính charCount từng đoạn                                 │
│     d. Bulk insert vào chapter_paragraphs                       │
│     e. Xóa paragraphs cũ nếu edit lại                          │
│                                                                  │
│  5. Backend trả về { paragraphCount, totalChars }               │
└─────────────────────────────────────────────────────────────────┘

1.3  Luồng khi Reader xem chương
  // Luồng reader đọc và comment inline
┌─────────────────────────────────────────────────────────────────┐
│  1. FE gọi GET /chapters/:id/content                            │
│  2. Backend trả về mảng RenderItem[]                            │
│                                                                  │
│  RenderItem có type:                                             │
│    "paragraph"    → { id, index, content, charCount }           │
│    "ad_slot"      → { adConfigId, position, adType }           │
│    "paywall"      → { requiredPlan, previewEndsAt }             │
│    "cta_sub"      → { ctaText, targetPlan }                     │
│                                                                  │
│  3. FE render từng RenderItem theo type                         │
│  4. User hover/click đoạn → hiện InlineComment button           │
│  5. User click button → fetch GET /paragraphs/:id/comments      │
│     → hiện CommentPopup ngay dưới đoạn đó                      │
└─────────────────────────────────────────────────────────────────┘

 
  PHẦN 2: DATABASE SCHEMA — PRISMA MODELS MỚI

2.1  Bảng chapter_paragraphs
Bảng trung tâm: lưu từng đoạn sau khi tách. Mỗi đoạn là 1 bản ghi có ID riêng.

Field	Type	Constraint	Mô tả
id	VARCHAR(36)	PK, UUID()	Primary key — UUID v4
chapter_id	VARCHAR(36)	FK → chapters.id	Chương chứa đoạn này
story_id	VARCHAR(36)	FK → stories.id, INDEX	Denormalize để query nhanh
paragraph_index	INT UNSIGNED	INDEX, NOT NULL	Thứ tự đoạn (0-based)
content	TEXT	NOT NULL	Nội dung văn bản đoạn
char_count	INT UNSIGNED	NOT NULL, DEFAULT 0	Cache số ký tự — dùng cho ad logic
cumulative_chars	INT UNSIGNED	INDEX	Tổng ký tự từ đầu chương đến đoạn này
is_paywall_start	TINYINT(1)	DEFAULT 0, INDEX	1 = đặt paywall ngay trước đoạn này
created_at	DATETIME(3)	DEFAULT NOW()	—

  // prisma/schema.prisma — ChapterParagraph
model ChapterParagraph {
  id               String   @id @default(uuid()) @db.VarChar(36)
  chapterId        String   @db.VarChar(36)
  storyId          String   @db.VarChar(36)
  paragraphIndex   Int      @db.UnsignedInt
  content          String   @db.Text
  charCount        Int      @default(0) @db.UnsignedInt
  cumulativeChars  Int      @default(0) @db.UnsignedInt
  isPaywallStart   Boolean  @default(false)
  createdAt        DateTime @default(now()) @db.DateTime(3)

  chapter  Chapter              @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  story    Story                @relation(fields: [storyId],   references: [id], onDelete: Cascade)
  comments ParagraphComment[]

  @@unique([chapterId, paragraphIndex])
  @@index([storyId])
  @@index([cumulativeChars])
  @@index([isPaywallStart])
  @@map("chapter_paragraphs")
}

2.2  Bảng paragraph_comments (Inline Comments)
Comment gắn với từng đoạn cụ thể. Hỗ trợ reply (self-referencing). Tách biệt hoàn toàn với chapter_end_comments.

Field	Type	Constraint	Mô tả
id	VARCHAR(36)	PK, UUID()	—
paragraph_id	VARCHAR(36)	FK → chapter_paragraphs.id	Đoạn được comment
chapter_id	VARCHAR(36)	FK, INDEX	Denormalize để query
story_id	VARCHAR(36)	FK, INDEX	Denormalize để query
user_id	VARCHAR(36)	FK → users.id, INDEX	Người comment
parent_id	VARCHAR(36)	FK (self), NULLABLE	Nếu là reply → parent comment
content	TEXT	NOT NULL	Nội dung comment
likes_count	INT UNSIGNED	DEFAULT 0	Cache like count
is_hidden	TINYINT(1)	DEFAULT 0	Admin ẩn comment vi phạm
created_at	DATETIME(3)	INDEX	—
updated_at	DATETIME(3)	—	—
deleted_at	DATETIME(3)	NULLABLE, INDEX	Soft delete

  // prisma/schema.prisma — ParagraphComment
model ParagraphComment {
  id          String   @id @default(uuid()) @db.VarChar(36)
  paragraphId String   @db.VarChar(36)
  chapterId   String   @db.VarChar(36)
  storyId     String   @db.VarChar(36)
  userId      String   @db.VarChar(36)
  parentId    String?  @db.VarChar(36)
  content     String   @db.Text
  likesCount  Int      @default(0) @db.UnsignedInt
  isHidden    Boolean  @default(false)
  createdAt   DateTime @default(now()) @db.DateTime(3)
  updatedAt   DateTime @updatedAt @db.DateTime(3)
  deletedAt   DateTime? @db.DateTime(3)

  paragraph ChapterParagraph       @relation(fields: [paragraphId], references: [id], onDelete: Cascade)
  user      User                   @relation(fields: [userId], references: [id])
  parent    ParagraphComment?      @relation("Replies", fields: [parentId], references: [id])
  replies   ParagraphComment[]     @relation("Replies")
  likes     ParagraphCommentLike[]

  @@index([paragraphId])
  @@index([chapterId])
  @@index([storyId])
  @@index([userId])
  @@index([parentId])
  @@index([createdAt])
  @@index([deletedAt])
  @@map("paragraph_comments")
}

model ParagraphCommentLike {
  userId     String @db.VarChar(36)
  commentId  String @db.VarChar(36)
  createdAt  DateTime @default(now()) @db.DateTime(3)

  user    User              @relation(fields: [userId],    references: [id])
  comment ParagraphComment  @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@id([userId, commentId])
  @@map("paragraph_comment_likes")
}

2.3  Bảng cấu hình Quảng Cáo (Ad Configs)
Hai bảng cấu hình: site_ad_configs (toàn cục) và story_ad_configs (override theo truyện). Cho phép CMS điều chỉnh linh hoạt.

  // prisma/schema.prisma — SiteAdConfig, StoryAdConfig
// ── Cấu hình quảng cáo toàn hệ thống ──────────────────────
model SiteAdConfig {
  id                   Int      @id @default(autoincrement())
  name                 String   @db.VarChar(100)  // Tên rule, VD: "Default Ad"
  adType               AdType                     // Loại quảng cáo
  triggerMode          AdTrigger                  // after_chars | after_paragraphs
  everyNChars          Int?                       // Chèn sau mỗi N ký tự
  everyNParagraphs     Int?                       // Chèn sau mỗi N đoạn
  firstAdAfterChars    Int      @default(500)     // Delay trước quảng cáo đầu tiên
  maxAdsPerChapter     Int      @default(5)       // Tối đa N quảng cáo/chương
  adHtmlContent        String?  @db.Text          // HTML/script quảng cáo
  adImageUrl           String?  @db.VarChar(500)
  adLinkUrl            String?  @db.VarChar(500)
  isActive             Boolean  @default(true)
  priority             Int      @default(0)       // Số cao = ưu tiên hơn
  createdAt            DateTime @default(now()) @db.DateTime(3)
  updatedAt            DateTime @updatedAt @db.DateTime(3)

  storyOverrides StoryAdConfig[]

  @@index([isActive])
  @@map("site_ad_configs")
}

// ── Override cấu hình riêng cho từng truyện ─────────────────
model StoryAdConfig {
  id               Int      @id @default(autoincrement())
  storyId          String   @db.VarChar(36)
  baseConfigId     Int?                          // Kế thừa từ SiteAdConfig
  adsDisabled      Boolean  @default(false)      // Tắt hoàn toàn ads cho truyện này
  everyNCharsOverride      Int?                  // Override everyNChars
  everyNParagraphsOverride Int?
  maxAdsOverride   Int?
  createdAt        DateTime @default(now()) @db.DateTime(3)

  story      Story         @relation(fields: [storyId], references: [id], onDelete: Cascade)
  baseConfig SiteAdConfig? @relation(fields: [baseConfigId], references: [id])

  @@unique([storyId, baseConfigId])
  @@map("story_ad_configs")
}

enum AdType {
  banner          // Ảnh + link quảng cáo
  native_text     // Quảng cáo dạng văn bản
  html_inject     // Custom HTML/script
  cta_subscribe   // CTA đăng ký gói hội viên
  cta_unlock      // CTA mở khóa chương
}

enum AdTrigger {
  after_chars       // Dựa theo tổng ký tự tích lũy
  after_paragraphs  // Dựa theo số đoạn
}

2.4  Cập nhật bảng chapters (thêm relation)
  // Cập nhật model Chapter
// Thêm vào model Chapter hiện có:
model Chapter {
  // ... các field hiện tại giữ nguyên ...

  // ── Field mới ───────────────────────────────────
  // textContent vẫn GIỮ NGUYÊN để backup / fallback
  // paragraphs sẽ là source-of-truth khi hiển thị
  hasParsedParagraphs Boolean @default(false)  // Flag đã tách đoạn
  totalParagraphs     Int     @default(0)       // Cache số đoạn
  totalChars          Int     @default(0)       // Cache tổng ký tự
  paywallAfterIndex   Int?    // Đặt paywall sau đoạn thứ N (null = không có)

  // ── Relations mới ───────────────────────────────
  paragraphs     ChapterParagraph[]
  // chapter_end_comments vẫn giữ nguyên
}

2.5  Bảng ad_placement_logs (Tracking)
  // prisma/schema.prisma — AdPlacementLog
// Track lượt hiển thị quảng cáo để analytics CMS
model AdPlacementLog {
  id           String   @id @default(uuid()) @db.VarChar(36)
  adConfigId   Int
  chapterId    String   @db.VarChar(36)
  storyId      String   @db.VarChar(36)
  afterParagraphIndex Int  // Quảng cáo nằm sau đoạn nào
  impressions  Int      @default(0)
  clicks       Int      @default(0)
  date         DateTime @db.Date  // Aggregate theo ngày

  @@unique([adConfigId, chapterId, afterParagraphIndex, date])
  @@index([storyId])
  @@index([date])
  @@map("ad_placement_logs")
}

 
  PHẦN 3: BACKEND — NESTJS PARAGRAPH SERVICE & API

3.1  ParagraphService — Logic tách đoạn
Service quan trọng nhất: nhận raw text, tách thành đoạn, tính toán cumulative chars, bulk insert vào DB.

  // paragraph.service.ts — parseAndSave()
// src/paragraphs/paragraph.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";

@Injectable()
export class ParagraphService {
  constructor(private prisma: PrismaService) {}

  // ── Tách và lưu đoạn văn ────────────────────────────────
  async parseAndSave(chapterId: string, storyId: string, rawText: string) {
    // 1. Tách theo dòng trống (\n\n hoặc \r\n\r\n)
    const rawParagraphs = rawText
      .split(/\r?\n\s*\r?\n/)  // regex handle cả Windows/Unix linebreaks
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (rawParagraphs.length === 0) return { paragraphCount: 0, totalChars: 0 };

    // 2. Tính char count và cumulative chars
    let cumulativeChars = 0;
    const paragraphData = rawParagraphs.map((content, index) => {
      const charCount = content.length;
      cumulativeChars += charCount;
      return {
        chapterId,
        storyId,
        paragraphIndex:  index,
        content,
        charCount,
        cumulativeChars, // tổng ký tự từ đầu đến cuối đoạn này
      };
    });

    // 3. Transaction: xóa cũ + insert mới + cập nhật chapter stats
    await this.prisma.$transaction([
      // Xóa paragraphs cũ (khi re-publish chương)
      this.prisma.chapterParagraph.deleteMany({ where: { chapterId } }),

      // Bulk insert tất cả đoạn
      this.prisma.chapterParagraph.createMany({ data: paragraphData }),

      // Cập nhật chapter metadata
      this.prisma.chapter.update({
        where: { id: chapterId },
        data: {
          hasParsedParagraphs: true,
          totalParagraphs: rawParagraphs.length,
          totalChars: cumulativeChars,
        },
      }),
    ]);

    return {
      paragraphCount: rawParagraphs.length,
      totalChars: cumulativeChars,
    };
  }

  // Lay paragraphs (raw, khong kem ads)
  async findByChapter(chapterId: string) {
    return this.prisma.chapterParagraph.findMany({
      where:   { chapterId },
      orderBy: { paragraphIndex: "asc" },
      select: {
        id: true, paragraphIndex: true, content: true,
        charCount: true, cumulativeChars: true, isPaywallStart: true,
      },
    });
  }
}

3.2  AdInjectionService — Logic chèn quảng cáo
Service tính toán vị trí chèn ads vào mảng paragraphs dựa trên config. Trả về mảng RenderItem[] đã có ads xen kẽ.

  // ad-injection.service.ts — buildRenderList()
// src/ads/ad-injection.service.ts
export type RenderItemType = "paragraph" | "ad_slot" | "paywall" | "cta_sub";

export interface RenderItem {
  type:    RenderItemType;
  // type === "paragraph"
  id?:     string;
  index?:  number;
  content?: string;
  charCount?: number;
  commentCount?: number;
  isPaywallStart?: boolean;
  // type === "ad_slot"
  adConfigId?:  number;
  adType?:      string;
  adHtml?:      string;
  adImageUrl?:  string;
  adLinkUrl?:   string;
  position?:    number;   // afterParagraphIndex — dùng cho tracking
  // type === "paywall"
  requiredPlan?: string;
  // type === "cta_sub"
  ctaText?: string;
}

@Injectable()
export class AdInjectionService {
  constructor(private prisma: PrismaService) {}

  async buildRenderList(
    chapterId: string,
    storyId:   string,
    userId?:   string,    // Nếu có user → kiểm tra membership
  ): Promise<RenderItem[]> {

    // 1. Lấy paragraphs từ DB
    const paragraphs = await this.prisma.chapterParagraph.findMany({
      where: { chapterId }, orderBy: { paragraphIndex: "asc" },
    });

    if (paragraphs.length === 0) return [];

    // 2. Lấy ad config (story override > site default)
    const adConfig = await this.resolveAdConfig(storyId);

    // 3. Kiểm tra user có membership không
    const hasMembership = userId
      ? await this.checkMembership(userId, storyId)
      : false;

    // 4. Build render list
    const result: RenderItem[] = [];
    let adsInserted = 0;
    let paywallTriggered = false;

    for (const para of paragraphs) {
      // ── Kiểm tra paywall ────────────────────────
      if (para.isPaywallStart && !hasMembership && !paywallTriggered) {
        result.push({
          type:         "paywall",
          requiredPlan: "vip",
          index:        para.paragraphIndex,
        });
        result.push({ type: "cta_sub", ctaText: "Đăng ký để đọc tiếp →" });
        paywallTriggered = true;
        break; // Dừng, không thêm paragraph sau paywall
      }

      // ── Push paragraph ───────────────────────────
      result.push({
        type:          "paragraph",
        id:            para.id,
        index:         para.paragraphIndex,
        content:       para.content,
        charCount:     para.charCount,
        isPaywallStart: para.isPaywallStart,
      });

      // ── Kiểm tra có nên chèn ad sau đoạn này không ──
      if (adConfig && !hasMembership && adsInserted < adConfig.maxAdsPerChapter) {
        const shouldInsertAd = adConfig.triggerMode === "after_chars"
          // Mỗi khi cumulativeChars vượt qua mốc N*everyNChars
          ? para.cumulativeChars >= adConfig.firstAdAfterChars &&
            Math.floor(para.cumulativeChars / adConfig.everyNChars!) >
            Math.floor((para.cumulativeChars - para.charCount) / adConfig.everyNChars!)
          // Mỗi N đoạn
          : (para.paragraphIndex + 1) % adConfig.everyNParagraphs! === 0 &&
            para.cumulativeChars >= adConfig.firstAdAfterChars;

        if (shouldInsertAd) {
          result.push({
            type:       "ad_slot",
            adConfigId: adConfig.id,
            adType:     adConfig.adType,
            adHtml:     adConfig.adHtmlContent ?? undefined,
            adImageUrl: adConfig.adImageUrl   ?? undefined,
            adLinkUrl:  adConfig.adLinkUrl    ?? undefined,
            position:   para.paragraphIndex,
          });
          adsInserted++;
        }
      }
    }

    return result;
  }

  // ── Resolve config: story override > site default ──────
  private async resolveAdConfig(storyId: string) {
    // Kiểm tra override cho truyện
    const storyOverride = await this.prisma.storyAdConfig.findFirst({
      where: { storyId },
      include: { baseConfig: true },
    });

    if (storyOverride?.adsDisabled) return null;  // Tắt hoàn toàn

    if (storyOverride?.baseConfig) {
      // Merge: story override các field cụ thể
      return {
        ...storyOverride.baseConfig,
        everyNChars: storyOverride.everyNCharsOverride ?? storyOverride.baseConfig.everyNChars,
        everyNParagraphs: storyOverride.everyNParagraphsOverride ?? storyOverride.baseConfig.everyNParagraphs,
        maxAdsPerChapter: storyOverride.maxAdsOverride ?? storyOverride.baseConfig.maxAdsPerChapter,
      };
    }

    // Fallback về default site config
    return this.prisma.siteAdConfig.findFirst({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    });
  }

  private async checkMembership(userId: string, storyId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { vipExpirationDate: true }
    });
    return !!user?.vipExpirationDate && user.vipExpirationDate > new Date();
  }
}

3.3  API Endpoints

Method	Endpoint	Auth	Mô tả
GET	/chapters/:id/content	Optional JWT	Trả RenderItem[] đã kèm ads + paywall
GET	/paragraphs/:id/comments	Optional JWT	Lấy inline comments của 1 đoạn
POST	/paragraphs/:id/comments	JWT Required	Đăng inline comment vào 1 đoạn
PATCH	/paragraph-comments/:id	JWT Required	Sửa comment của chính mình
DELETE	/paragraph-comments/:id	JWT Required	Xóa soft-delete comment
POST	/paragraph-comments/:id/like	JWT Required	Like/unlike inline comment
POST	/admin/chapters/:id/publish	Admin	Parse text → lưu paragraphs, trigger ad calc
PATCH	/admin/chapters/:id/paywall	Admin	Đặt paragraphIndex bắt đầu paywall
GET	/admin/ad-configs	Admin	CRUD site_ad_configs
POST	/admin/ad-configs	Admin	Tạo rule quảng cáo mới
PATCH	/admin/stories/:id/ad-config	Admin	Override cấu hình ads cho truyện
GET	/admin/analytics/ads	Admin	Thống kê impressions/clicks theo ngày

3.3.1 — POST /admin/chapters/:id/publish — Request Body
  // API Request/Response Example
POST /api/v1/admin/chapters/:chapterId/publish
Authorization: Bearer <admin_token>

{
  "textContent": "Đây là đoạn đầu tiên của chương.\n\n
                   Đây là đoạn thứ hai, cách bởi dòng trống.\n\n
                   Đoạn thứ ba nói về chuyện khác...",

  "paywallAfterIndex": 5,   // Optional: paywall sau đoạn thứ 5
  "adConfigOverride": {     // Optional: override ads cho chương này
    "disabled": false,
    "everyNChars": 800
  }
}

// Response:
{
  "success": true,
  "data": {
    "chapterId": "uuid",
    "paragraphCount": 12,
    "totalChars": 4250,
    "paywallSetAt": 5,
    "estimatedAds": 4
  }
}

3.3.2 — GET /paragraphs/:id/comments — Response
  // GET /paragraphs/:id/comments Response
GET /api/v1/paragraphs/para-uuid-123/comments?page=1&limit=10

{
  "success": true,
  "data": {
    "paragraphId": "para-uuid-123",
    "totalComments": 7,
    "comments": [
      {
        "id": "cmt-uuid-1",
        "content": "Đoạn này hay quá!",
        "user": { "id": "...", "displayName": "Minh Anh", "avatarUrl": "..." },
        "likesCount": 5,
        "isLikedByMe": true,    // Nếu có JWT
        "createdAt": "2025-03-01T10:00:00Z",
        "replies": [            // Nested replies (max 1 cấp)
          {
            "id": "cmt-uuid-2",
            "content": "Đồng ý nha!",
            "user": { "displayName": "Tuấn" },
            "likesCount": 1,
            "createdAt": "..."
          }
        ]
      }
    ],
    "pagination": { "page": 1, "total": 7, "totalPages": 1 }
  }
}

 
  PHẦN 4: FRONTEND — READER UI & INLINE COMMENT

4.1  Kiến trúc Component
  // Cấu trúc component tree
ChapterContent                 ← container chính
  ├── RenderItemList           ← render mảng RenderItem[]
  │     ├── ParagraphBlock     ← type="paragraph"
  │     │     ├── Hiển thị text
  │     │     ├── CommentTrigger (hover → hiện icon 💬)
  │     │     └── InlineCommentPopup (click → mở popup)
  │     ├── AdSlot             ← type="ad_slot"
  │     │     ├── BannerAd
  │     │     ├── NativeTextAd
  │     │     └── CtaSubscribe
  │     └── PaywallBlock       ← type="paywall"
  │           ├── BlurOverlay
  │           └── SubscriptionCTA
  └── ChapterEndComments       ← comment cuối chương (giữ nguyên)

4.2  ParagraphBlock + InlineCommentPopup
  // ParagraphBlock.tsx — hover trigger + popup positioning
// src/components/reader/ParagraphBlock.tsx
"use client";
import { useState, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { InlineCommentPopup } from "./InlineCommentPopup";
import type { RenderItem } from "@/types/reader.types";

interface Props {
  item: RenderItem;
  isLoggedIn: boolean;
}

export function ParagraphBlock({ item, isLoggedIn }: Props) {
  const [showPopup, setShowPopup]     = useState(false);
  const [isHovered, setIsHovered]     = useState(false);
  const paragraphRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={paragraphRef}
      data-paragraph-id={item.id}
      className="relative group my-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Nội dung đoạn văn */}
      <p className="text-gray-800 leading-relaxed text-[17px]">
        {item.content}
      </p>

      {/* Icon comment — chỉ hiện khi hover */}
      <button
        onClick={() => setShowPopup(true)}
        className={[
          "absolute -right-8 top-1/2 -translate-y-1/2",
          "flex items-center gap-1 text-xs text-gray-400",
          "hover:text-blue-500 transition-all",
          isHovered ? "opacity-100" : "opacity-0",
        ].join(" ")}
        title="Bình luận đoạn này"
      >
        <MessageCircle size={16} />
        {(item.commentCount ?? 0) > 0 && (
          <span className="text-[11px]">{item.commentCount}</span>
        )}
      </button>

      {/* Popup comment — xuất hiện NGAY DƯỚI đoạn */}
      {showPopup && (
        <InlineCommentPopup
          paragraphId={item.id!}
          isLoggedIn={isLoggedIn}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}

4.3  InlineCommentPopup Component
  // InlineCommentPopup.tsx — Đầy đủ component
// src/components/reader/InlineCommentPopup.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ThumbsUp, Send, ChevronDown } from "lucide-react";
import { api } from "@/lib/axios";

interface Props {
  paragraphId: string;
  isLoggedIn:  boolean;
  onClose:     () => void;
}

export function InlineCommentPopup({ paragraphId, isLoggedIn, onClose }: Props) {
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo]       = useState<string | null>(null);
  const qc = useQueryClient();
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch comments khi popup mở
  const { data, isLoading } = useQuery({
    queryKey: ["paragraph-comments", paragraphId],
    queryFn:  () => api.get(`/paragraphs/${paragraphId}/comments`).then(r => r.data.data),
    staleTime: 30_000,
  });

  // Submit comment
  const submitMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/paragraphs/${paragraphId}/comments`, {
        content,
        parentId: replyTo,
      }),
    onSuccess: () => {
      setNewComment(""); setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["paragraph-comments", paragraphId] });
    },
  });

  // Đóng khi click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    // Popup xuất hiện ngay dưới đoạn văn (position relative to parent)
    <div
      ref={popupRef}
      className="mt-2 mb-4 p-3 bg-white border border-gray-200 rounded-xl
                 shadow-lg w-full max-w-lg animate-in slide-in-from-top-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">
          Bình luận đoạn này
          {data?.totalComments > 0 && (
            <span className="ml-2 text-blue-500">({data.totalComments})</span>
          )}
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* Danh sách comments */}
      <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
        {isLoading && <p className="text-xs text-gray-400 text-center">Đang tải...</p>}
        {data?.comments?.map((cmt: any) => (
          <div key={cmt.id} className="flex gap-2">
            <img src={cmt.user.avatarUrl} className="w-6 h-6 rounded-full shrink-0 mt-0.5" alt="" />
            <div className="flex-1 min-w-0">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold">{cmt.user.displayName}</p>
                <p className="text-sm text-gray-700 mt-0.5">{cmt.content}</p>
              </div>
              <div className="flex items-center gap-3 mt-1 pl-2">
                <button
                  onClick={() => setReplyTo(cmt.id)}
                  className="text-[11px] text-gray-400 hover:text-blue-500"
                >
                  Trả lời
                </button>
                <button className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500">
                  <ThumbsUp size={11} /> {cmt.likesCount}
                </button>
              </div>
              {/* Nested replies */}
              {cmt.replies?.map((reply: any) => (
                <div key={reply.id} className="flex gap-2 mt-2 ml-4">
                  <img src={reply.user.avatarUrl} className="w-5 h-5 rounded-full shrink-0 mt-0.5" alt="" />
                  <div className="bg-blue-50 rounded-lg px-2 py-1.5 flex-1">
                    <p className="text-[11px] font-semibold">{reply.user.displayName}</p>
                    <p className="text-xs text-gray-700">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {data?.comments?.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">
            Chưa có bình luận nào cho đoạn này
          </p>
        )}
      </div>

      {/* Input */}
      {isLoggedIn ? (
        <div>
          {replyTo && (
            <div className="text-xs text-blue-500 mb-1 flex items-center gap-1">
              Đang trả lời...
              <button onClick={() => setReplyTo(null)} className="text-gray-400"><X size={10}/></button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newComment.trim()) {
                  submitMutation.mutate(newComment.trim());
                }
              }}
              placeholder="Viết bình luận về đoạn này..."
              className="flex-1 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => newComment.trim() && submitMutation.mutate(newComment.trim())}
              disabled={!newComment.trim() || submitMutation.isPending}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600
                         disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-center text-gray-500 py-1">
          <a href="/dang-nhap" className="text-blue-500 hover:underline">Đăng nhập</a> để bình luận
        </p>
      )}
    </div>
  );
}

4.4  AdSlot Component
  // AdSlot.tsx — Render + Impression Tracking
// src/components/reader/AdSlot.tsx
"use client";
import { useEffect, useRef } from "react";
import { api } from "@/lib/axios";
import type { RenderItem } from "@/types/reader.types";

export function AdSlot({ item }: { item: RenderItem }) {
  const adRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(false);

  // Track impression khi ad xuất hiện trong viewport
  useEffect(() => {
    if (!adRef.current || trackedRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !trackedRef.current) {
        trackedRef.current = true;
        // Fire-and-forget impression tracking
        api.post("/ads/track", {
          adConfigId: item.adConfigId,
          position: item.position,
          event: "impression",
        }).catch(() => {}); // Không block UI nếu fail
      }
    }, { threshold: 0.5 });
    observer.observe(adRef.current);
    return () => observer.disconnect();
  }, [item.adConfigId]);

  const handleClick = () => {
    api.post("/ads/track", {
      adConfigId: item.adConfigId, position: item.position, event: "click",
    }).catch(() => {});
    if (item.adLinkUrl) window.open(item.adLinkUrl, "_blank", "noopener");
  };

  if (item.adType === "cta_subscribe") {
    return (
      <div className="my-6 p-4 bg-gradient-to-r from-blue-600 to-purple-600
                      rounded-xl text-white text-center">
        <p className="font-bold text-lg">🎧 Mở khóa toàn bộ nội dung</p>
        <p className="text-sm opacity-90 mt-1">Đăng ký hội viên để đọc không giới hạn</p>
        <a href="/nap-tien" className="mt-3 inline-block bg-white text-blue-600
                                       font-bold px-6 py-2 rounded-full text-sm
                                       hover:bg-gray-100 transition-colors">
          Đăng ký ngay
        </a>
      </div>
    );
  }

  if (item.adType === "html_inject" && item.adHtml) {
    return (
      <div
        ref={adRef}
        className="my-4 ad-container"
        dangerouslySetInnerHTML={{ __html: item.adHtml }}
      />
    );
  }

  // Default: banner quảng cáo ảnh
  return (
    <div ref={adRef} className="my-4 relative">
      <span className="absolute top-1 left-1 text-[9px] text-gray-400
                       bg-gray-100 px-1 rounded">Quảng cáo</span>
      {item.adImageUrl && (
        <button onClick={handleClick} className="w-full">
          <img
            src={item.adImageUrl} alt="Quảng cáo"
            className="w-full rounded-lg object-cover max-h-24"
          />
        </button>
      )}
    </div>
  );
}

4.5  PaywallBlock + RenderItemList (Orchestrator)
  // RenderItemList.tsx — Orchestrator component
// src/components/reader/RenderItemList.tsx
"use client";
import { ParagraphBlock } from "./ParagraphBlock";
import { AdSlot }         from "./AdSlot";
import { PaywallBlock }   from "./PaywallBlock";
import type { RenderItem } from "@/types/reader.types";

interface Props {
  items:      RenderItem[];
  isLoggedIn: boolean;
}

export function RenderItemList({ items, isLoggedIn }: Props) {
  return (
    <div className="chapter-content max-w-2xl mx-auto px-4">
      {items.map((item, i) => {
        switch (item.type) {
          case "paragraph":
            return (
              <ParagraphBlock
                key={item.id}
                item={item}
                isLoggedIn={isLoggedIn}
              />
            );
          case "ad_slot":
            return <AdSlot key={`ad-${item.position}-${i}`} item={item} />;
          case "paywall":
            return <PaywallBlock key="paywall" item={item} />;
          case "cta_sub":
            return (
              <div key="cta_sub" className="my-6 p-5 border-2 border-dashed
                                            border-blue-300 rounded-xl text-center">
                <p className="text-blue-600 font-semibold text-lg">
                  🔒 Nội dung bị giới hạn
                </p>
                <p className="text-gray-500 text-sm mt-1 mb-3">
                  Đăng ký hội viên để tiếp tục đọc không giới hạn
                </p>
                <a href="/nap-tien"
                   className="bg-blue-600 text-white px-6 py-2.5 rounded-full
                              font-semibold text-sm hover:bg-blue-700 transition-colors">
                  Mở khóa ngay →
                </a>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

// src/components/reader/PaywallBlock.tsx
export function PaywallBlock({ item }: { item: RenderItem }) {
  return (
    <div className="relative mt-4">
      {/* Hiệu ứng mờ dần vào blur */}
      <div className="h-24 bg-gradient-to-b from-transparent to-white" />
      <div className="absolute inset-0 backdrop-blur-sm bg-white/50 rounded-b-lg
                      flex items-end justify-center pb-4">
        <p className="text-sm text-gray-500 italic">
          ... nội dung bị ẩn — đăng ký để đọc tiếp ...
        </p>
      </div>
    </div>
  );
}

 
  PHẦN 5: CMS — QUẢN LÝ ADS & INLINE COMMENTS

5.1  Màn hình CMS — Tổng quan module mới
Module CMS	Tính năng	Route CMS	Priority
Cấu hình Ads	CRUD site_ad_configs: tên, loại, trigger mode, mỗi N ký tự/đoạn, max ads	/admin/ads/configs	🔴 Cao
Cấu hình Ads	Override ads theo từng truyện, bật/tắt, custom rules	/admin/stories/:id/ads	🔴 Cao
Preview Chapter	Xem trước RenderItem[] sau khi tách đoạn, thấy vị trí ads trước khi publish	/admin/chapters/:id/preview	🔴 Cao
Paywall config	Kéo thả để chọn đoạn bắt đầu paywall trên màn hình preview	/admin/chapters/:id/paywall	🔴 Cao
Inline Comments	Danh sách inline comments, lọc theo truyện/chương, moderate (ẩn/xóa)	/admin/paragraph-comments	🟡 TB
Ad Analytics	Bảng impressions/clicks theo ngày, theo adConfig, theo truyện	/admin/analytics/ads	🟡 TB
Bulk Publish	Upload nhiều chương → auto-parse → publish queue	/admin/chapters/bulk	🟢 Thấp

5.2  UI Cấu hình Quảng Cáo (AdConfigForm)
  // AdConfigForm.tsx — UI Layout + Validation
// src/admin/components/AdConfigForm.tsx
// Form CMS tạo/sửa rule quảng cáo — key fields:

/*
  ┌─────────────────────────────────────────────────────┐
  │  TÊN RULE:  [Default Ad Rule              ]         │
  │  LOẠI ADS:  ○ Banner  ○ Native Text  ○ HTML        │
  │             ○ CTA Subscribe  ○ CTA Unlock          │
  │                                                     │
  │  CƠ CHẾ:   ○ Sau mỗi N ký tự   ○ Sau mỗi N đoạn  │
  │                                                     │
  │  [Sau mỗi N ký tự được chọn]                       │
  │  Ký tự delay đầu tiên: [500     ]                  │
  │  Chèn ad sau mỗi:      [800     ] ký tự            │
  │  Tối đa ads/chương:    [5       ]                  │
  │                                                     │
  │  NỘI DUNG AD:                                      │
  │  Ảnh quảng cáo: [Upload ảnh...]                    │
  │  Link khi click: [https://...]                     │
  │                                                     │
  │  TRẠNG THÁI: ● Đang hoạt động                     │
  │  ƯU TIÊN:    [0] (số cao hơn = ưu tiên hơn)       │
  │                                                     │
  │  [ Hủy ]              [ Lưu cấu hình ]             │
  └─────────────────────────────────────────────────────┘
*/

// Validation (Zod schema CMS):
const adConfigSchema = z.object({
  name:                z.string().min(1).max(100),
  adType:              z.enum(["banner","native_text","html_inject","cta_subscribe","cta_unlock"]),
  triggerMode:         z.enum(["after_chars","after_paragraphs"]),
  everyNChars:         z.number().min(200).max(5000).optional(),
  everyNParagraphs:    z.number().min(1).max(20).optional(),
  firstAdAfterChars:   z.number().min(0).max(2000).default(500),
  maxAdsPerChapter:    z.number().min(0).max(20).default(5),
  adImageUrl:          z.string().url().optional(),
  adLinkUrl:           z.string().url().optional(),
  adHtmlContent:       z.string().max(10000).optional(),
  isActive:            z.boolean().default(true),
  priority:            z.number().default(0),
}).refine(d => {
  if (d.triggerMode === "after_chars"      && !d.everyNChars)      return false;
  if (d.triggerMode === "after_paragraphs" && !d.everyNParagraphs) return false;
  return true;
}, { message: "Phải điền số tương ứng với cơ chế đã chọn" });

5.3  Màn hình Preview Chapter với Ad Positions
Khi Admin xem preview chương, hệ thống hiển thị đoạn văn cùng với vị trí ads dự kiến được đánh dấu. Admin có thể kéo thả để đặt paywall.
  // AdminChapterPreview.tsx — Drag-drop Paywall Config
// src/admin/pages/chapters/[id]/preview.tsx
"use client";

// Admin preview: hiển thị danh sách RenderItem[]
// Mỗi ad_slot được highlight màu vàng
// Paywall trigger được đánh dấu màu đỏ

function AdminChapterPreview({ chapterId }) {
  const { data: renderItems } = useQuery({
    queryKey: ["admin-preview", chapterId],
    queryFn: () =>
      // Admin endpoint: luôn trả FULL content kể cả sau paywall
      api.get(`/admin/chapters/${chapterId}/preview`).then(r => r.data.data),
  });

  const [paywallAt, setPaywallAt] = useState<number | null>(null);

  const savePaywall = async (paragraphIndex: number) => {
    await api.patch(`/admin/chapters/${chapterId}/paywall`, { paragraphIndex });
    setPaywallAt(paragraphIndex);
    toast.success(`Paywall đặt tại đoạn #${paragraphIndex + 1}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Thống kê */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Số đoạn"   value={renderItems?.filter(i=>i.type==="paragraph").length} />
        <StatCard label="Số quảng cáo" value={renderItems?.filter(i=>i.type==="ad_slot").length} />
        <StatCard label="Tổng ký tự" value={renderItems?.reduce((a,i)=>a+(i.charCount||0),0)} />
      </div>

      {/* Preview */}
      {renderItems?.map((item, i) => (
        <div key={i} className="relative group">
          {item.type === "paragraph" && (
            <div className={`my-3 p-2 rounded border-l-4 ${
              paywallAt === item.index
                ? "border-red-500 bg-red-50"
                : "border-transparent hover:border-gray-200"
            }`}>
              <p className="text-sm text-gray-700 leading-relaxed">{item.content}</p>
              {/* Admin: nút đặt paywall tại đoạn này */}
              <button
                onClick={() => savePaywall(item.index!)}
                className="hidden group-hover:flex absolute right-0 top-1/2 -translate-y-1/2
                           items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-1 rounded"
              >
                🔒 Đặt Paywall đây
              </button>
            </div>
          )}
          {item.type === "ad_slot" && (
            <div className="my-2 py-2 px-4 bg-yellow-50 border border-yellow-300
                            rounded-lg text-center text-xs text-yellow-700 font-medium">
              📢 VỊ TRÍ QUẢNG CÁO — sau đoạn #{item.position}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

 
  PHẦN 6: MIGRATION PLAN & LƯU Ý KỸ THUẬT

6.1  Migration Plan — Thứ tự triển khai
Bước	Công việc	Lệnh / Ghi chú	Sprint
1	Thêm fields mới vào Chapter model (hasParsedParagraphs, totalParagraphs, totalChars, paywallAfterIndex)	npx prisma migrate dev --name add_paragraph_fields	Sprint 2
2	Tạo model ChapterParagraph + ParagraphComment + ParagraphCommentLike	npx prisma migrate dev --name create_paragraph_tables	Sprint 2
3	Tạo model SiteAdConfig + StoryAdConfig + AdPlacementLog	npx prisma migrate dev --name create_ad_config_tables	Sprint 2
4	Viết ParagraphService.parseAndSave() + API admin/chapters/:id/publish	Thêm vào ChaptersModule	Sprint 2
5	Viết AdInjectionService.buildRenderList() + API /chapters/:id/content	Thêm vào StoryModule	Sprint 3
6	Viết ParagraphCommentController + Service + APIs	Module mới: ParagraphCommentModule	Sprint 3
7	Seeding: Parse toàn bộ chapter có textContent cũ → chapter_paragraphs	Script seed/migrate-paragraphs.ts	Sprint 3
8	Frontend: ParagraphBlock + InlineCommentPopup + AdSlot + RenderItemList	Tích hợp vào trang chi tiết truyện	Sprint 4
9	CMS: AdConfigForm + AdminChapterPreview + PaywallConfig	Tích hợp vào Admin panel	Sprint 4
10	Analytics: AdPlacementLog tracking + Dashboard chart	Tích hợp vào Admin Analytics	Sprint 5

6.2  Script Migrate Data Cũ
Cần script chuyển đổi các chapters đã có textContent sang hệ thống paragraph mới. Chạy 1 lần sau khi deploy.
  // scripts/seed/migrate-paragraphs.ts
// scripts/seed/migrate-paragraphs.ts
import { PrismaClient } from "@prisma/client";
import { ParagraphService } from "../../src/paragraphs/paragraph.service";

const prisma = new PrismaClient();

async function migrateChapters() {
  console.log("🚀 Bắt đầu migrate paragraphs...");

  // Lấy tất cả chapter có textContent nhưng chưa parse
  const chapters = await prisma.chapter.findMany({
    where: {
      textContent: { not: null },
      hasParsedParagraphs: false,
      deletedAt: null,
    },
    select: { id: true, storyId: true, textContent: true },
  });

  console.log(`📚 Tìm thấy ${chapters.length} chapters cần migrate`);

  let success = 0; let errors = 0;

  // Xử lý từng batch 100 chapters để tránh overwhelm DB
  for (let i = 0; i < chapters.length; i += 100) {
    const batch = chapters.slice(i, i + 100);
    await Promise.allSettled(
      batch.map(async (ch) => {
        try {
          const svc = new ParagraphService(prisma);
          await svc.parseAndSave(ch.id, ch.storyId, ch.textContent!);
          success++;
        } catch (err) {
          console.error(`❌ Chapter ${ch.id}:`, err);
          errors++;
        }
      })
    );
    console.log(`  Processed ${Math.min(i+100, chapters.length)}/${chapters.length}...`);
  }

  console.log(`✅ Done: ${success} success, ${errors} errors`);
  await prisma.$disconnect();
}

migrateChapters();
// Chạy: ts-node scripts/seed/migrate-paragraphs.ts

6.3  Edge Cases & Lưu ý quan trọng

⚠️ Lưu ý 1 — Đồng bộ textContent và paragraphs
Giữ nguyên field textContent trong bảng chapters như fallback. Khi render:
• Nếu hasParsedParagraphs=true → dùng chapter_paragraphs
• Nếu hasParsedParagraphs=false → dùng textContent gốc (render dạng plain text)
Điều này đảm bảo backward compatibility với chapters cũ chưa được migrate.

⚠️ Lưu ý 2 — Hiệu năng comment inline
Không fetch tất cả inline comments ngay khi load trang (N+1 problem).
Thay vào đó:
• Chỉ fetch commentCount cho mỗi paragraph khi load chương
• Chỉ fetch full comments khi user click vào icon 💬 của đoạn đó
• Dùng React Query để cache theo paragraphId
Thêm GET /chapters/:id/comment-counts → { paragraphId: commentCount }[]

⚠️ Lưu ý 3 — XSS với adHtmlContent
Field adHtmlContent cho phép admin nhập HTML/script tùy ý. Bắt buộc:
• Chỉ ADMIN role mới được đặt adHtmlContent
• Sử dụng dangerouslySetInnerHTML với CSP headers
• Thêm Content-Security-Policy header trên Nginx để giới hạn domain script
• Nên dùng Sanitize HTML library (DOMPurify) trước khi lưu DB

✅ Best Practice — Re-publish chương
Khi admin edit và re-publish chương:
1. Transaction: DELETE old paragraphs WHERE chapterId
2. INSERT new paragraphs
3. Inline comments CŨ bị mồ côi (orphan) do paragraphId không còn tồn tại
→ Giải pháp: Thêm cột "isOrphaned" trong paragraph_comments
  Trước khi delete paragraphs, SET isOrphaned=true WHERE chapterId
  Admin xem được orphaned comments trong CMS để review

6.4  Estimate thời gian
Hạng mục	Backend (giờ)	Frontend (giờ)	CMS (giờ)	Tổng
DB Schema + Migration	3	—	—	3h
ParagraphService (parse)	4	—	—	4h
AdInjectionService	6	—	—	6h
ParagraphComment APIs	8	—	—	8h
GET /chapters/:id/content (RenderItem[])	4	—	—	4h
ParagraphBlock + CommentPopup FE	—	12	—	12h
AdSlot + PaywallBlock FE	—	6	—	6h
RenderItemList (orchestrator)	—	3	—	3h
CMS: AdConfigForm	—	—	8	8h
CMS: Chapter Preview + Paywall drag	—	—	10	10h
CMS: Inline Comment Moderate	—	—	5	5h
Data migration script	4	—	—	4h
TỔNG	29h	21h	23h	~73h


