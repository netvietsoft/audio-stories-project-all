> Cap nhat 2026-03-06: Tai lieu nay la ban design cu (target architecture).
> Ban dong bo theo codebase hien tai + roadmap tiep theo duoc tong hop trong 1 file:
> `github/doc-codebase-sync-2026-03.md`

🎧 WEB TRUYỆN AUDIO
Technical Design Document
Fullstack Implementation Guide — Backend · Frontend · Audio Player


Tech Stack
• Backend: NestJS · Prisma ORM · MySQL (TiDB Cloud)
• Frontend: Next.js 14 App Router · Tailwind CSS · Lucide React
• State: Zustand · HTTP: Axios · Audio: HTML5 Audio API
• Storage: Cloudflare R2 · CDN (Presigned URL Flow)

Phạm vi tài liệu (Scope)
• Module 1 — Trang chủ (Home): Banner · Featured · Trending · Mới cập nhật
• Module 2 — Khám phá (Explore): Filter động · Danh sách · Phân trang
• Module 3 — Chi tiết truyện & Global Audio Player: Chapters · Sticky Mini Player



Version 1.0   |   Tháng 3/2025   |   Tài liệu nội bộ
 
  PHẦN 1: DATABASE & BACKEND (NESTJS + PRISMA)

1.1  Database Schema — Prisma Models
Dựa trên file db schema đính kèm, dưới đây là toàn bộ Prisma models cần thiết cho 3 module cốt lõi. Mỗi model ánh xạ trực tiếp bảng MySQL đã thiết kế.

Model: Story
  // prisma/schema.prisma — Story
model Story {
  id             String    @id @default(uuid()) @db.VarChar(36)
  title          String    @db.VarChar(300)
  slug           String    @unique @db.VarChar(350)
  description    String?   @db.Text
  thumbnailUrl   String?   @db.Text
  authorId       String    @db.VarChar(36)
  status         StoryStatus @default(ongoing)
  totalChapters  Int       @default(0) @db.UnsignedInt
  totalViews     BigInt    @default(0)
  averageRating  Decimal   @default(0) @db.Decimal(3,2)
  ratingCount    Int       @default(0) @db.UnsignedInt
  isFeatured     Boolean   @default(false)
  featuredOrder  Int?
  publishedAt    DateTime? @db.DateTime(3)
  createdAt      DateTime  @default(now()) @db.DateTime(3)
  updatedAt      DateTime  @updatedAt @db.DateTime(3)
  deletedAt      DateTime? @db.DateTime(3)

  author     Author           @relation(fields: [authorId], references: [id])
  categories StoryCategory[]
  chapters   Chapter[]

  @@index([status])
  @@index([isFeatured])
  @@index([totalViews(sort: Desc)])
  @@index([averageRating(sort: Desc)])
  @@index([updatedAt(sort: Desc)])
  @@index([publishedAt])
  @@index([deletedAt])
  @@fulltext([title, description])
  @@map("stories")
}

enum StoryStatus {
  ongoing
  completed
}

Model: Chapter
  // prisma/schema.prisma — Chapter
model Chapter {
  id              String      @id @default(uuid()) @db.VarChar(36)
  storyId         String      @db.VarChar(36)
  title           String      @db.VarChar(300)
  chapterNumber   Int         @db.UnsignedInt
  type            ChapterType @default(free)
  youtubeVideoId  String?     @db.VarChar(50)   // Video ID YouTube (VD: "dQw4w9WgXcQ")
  r2AudioUrl      String?     @db.Text           // Public URL Cloudflare R2
  duration        Int?        @db.UnsignedInt    // Giây
  textContent     String?     @db.LongText       // Nội dung văn bản
  unlocksAt       DateTime?   @db.DateTime(3)    // Cho chapter timed
  viewCount       Int         @default(0) @db.UnsignedInt
  isPublished     Boolean     @default(true)
  createdAt       DateTime    @default(now()) @db.DateTime(3)
  updatedAt       DateTime    @updatedAt @db.DateTime(3)
  deletedAt       DateTime?   @db.DateTime(3)

  story  Story @relation(fields: [storyId], references: [id])

  @@index([storyId])
  @@index([chapterNumber])
  @@index([type])
  @@index([deletedAt])
  @@map("chapters")
}

enum ChapterType {
  free
  vip
  timed
}

Model: Author & Category
  // prisma/schema.prisma — Author, Category, StoryCategory
model Author {
  id             String   @id @default(uuid()) @db.VarChar(36)
  name           String   @db.VarChar(150)
  slug           String   @unique @db.VarChar(200)
  avatarUrl      String?  @db.Text
  bio            String?  @db.Text
  followersCount Int      @default(0) @db.UnsignedInt
  createdAt      DateTime @default(now()) @db.DateTime(3)
  updatedAt      DateTime @updatedAt @db.DateTime(3)

  stories Story[]

  @@index([name])
  @@fulltext([name])
  @@map("authors")
}

model Category {
  id          Int      @id @default(autoincrement()) @db.UnsignedInt
  name        String   @unique @db.VarChar(100)
  slug        String   @unique @db.VarChar(120)
  description String?  @db.Text
  iconUrl     String?  @db.VarChar(255)
  createdAt   DateTime @default(now()) @db.DateTime(3)

  stories StoryCategory[]

  @@map("categories")
}

model StoryCategory {
  storyId    String   @db.VarChar(36)
  categoryId Int      @db.UnsignedInt
  createdAt  DateTime @default(now()) @db.DateTime(3)

  story    Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([storyId, categoryId])
  @@index([categoryId])
  @@map("story_categories")
}


1.2  API Endpoints — Đặc tả chi tiết
Tất cả endpoints đều có prefix /api/v1. Response chuẩn có dạng: { success, data, message, pagination? }.

1.2.1 — Home APIs
Method	Endpoint	Auth	Mô tả
GET	/stories/home	Public	Trả về 4 sections: featured, trending, newest, popular
GET	/stories/featured	Public	Banner hero: truyện is_featured=true, order asc
GET	/stories/trending	Public	Sắp theo total_views DESC, cache 10 phút
GET	/stories/newest	Public	Sắp theo updated_at DESC, limit 16
GET	/stories/popular	Public	Sắp theo average_rating DESC, limit 16
GET	/categories/featured	Public	Top thể loại theo số truyện

1.2.2 — Explore API (Filter + Pagination)
Method	Endpoint	Auth	Mô tả
GET	/stories/explore	Public	Filter động: category, author, status, sort, q, page, limit
GET	/categories	Public	Lấy toàn bộ thể loại kèm story_count
GET	/authors	Public	Danh sách tác giả, filter by name, phân trang

Query Parameters — GET /stories/explore
Tham số	Kiểu	Mặc định	Mô tả
q	string	—	Full-text search trên title, description
categorySlug	string	—	Slug thể loại (VD: ngon-tinh)
authorId	string	—	UUID tác giả
status	ongoing|completed	—	Trạng thái truyện
sort	newest|trending|popular|updated	newest	Tiêu chí sắp xếp
page	number	1	Trang hiện tại
limit	number	16	Số item/trang (max 50)

1.2.3 — Story Detail & Chapter APIs
Method	Endpoint	Auth	Mô tả
GET	/stories/:slug	Public	Chi tiết truyện kèm author, categories, chapter count
GET	/stories/:id/chapters	Public	Danh sách chương, phân trang, kèm type badge
GET	/chapters/:id	JWT Optional	Chi tiết chương, kiểm tra quyền truy cập
GET	/chapters/:id/download	JWT Required	Sinh presigned URL tải MP3 (R2 GetObject)
POST	/stories/:id/view	Public	Tăng view count (debounce 30s theo IP)

1.2.4 — Response Examples
Response: GET /stories/home
  // Response Example: GET /api/v1/stories/home
{
  "success": true,
  "data": {
    "featured": [           // Banner hero — max 5
      {
        "id": "uuid",
        "title": "Đại Quan Gia",
        "slug": "dai-quan-gia",
        "thumbnailUrl": "https://cdn.r2.../img.jpg",
        "featuredOrder": 1,
        "author": { "name": "Nguyễn Nhật Ánh", "slug": "nguyen-nhat-anh" },
        "categories": [{ "name": "Ngôn tình", "slug": "ngon-tinh" }],
        "totalViews": 125000,
        "averageRating": 4.85
      }
    ],
    "trending": [ /* StoryCard[] — 16 items */ ],
    "newest":   [ /* StoryCard[] — 16 items */ ],
    "popular":  [ /* StoryCard[] — 16 items */ ]
  }
}

Response: GET /stories/explore (phân trang)
  // Response Example: GET /api/v1/stories/explore
{
  "success": true,
  "data": {
    "items": [ /* StoryCard[] */ ],
    "pagination": {
      "total": 248,
      "page": 1,
      "limit": 16,
      "totalPages": 16,
      "hasNextPage": true
    }
  }
}


1.3  Luồng xử lý Logic Backend (NestJS + Prisma)

1.3.1 — GET /stories/home — Service Logic
  // stories.service.ts
// src/stories/stories.service.ts
async getHomeData(): Promise<HomeDto> {
  const [featured, trending, newest, popular] = await Promise.all([

    // 1. FEATURED — truyện banner (is_featured + published)
    this.prisma.story.findMany({
      where: { isFeatured: true, deletedAt: null, publishedAt: { not: null } },
      orderBy: { featuredOrder: "asc" },
      take: 5,
      include: { author: true, categories: { include: { category: true } } },
    }),

    // 2. TRENDING — cache Memory 10 phút
    this.cacheManager.wrap("trending_stories", () =>
      this.prisma.story.findMany({
        where: { deletedAt: null, publishedAt: { not: null } },
        orderBy: { totalViews: "desc" },
        take: 16,
        include: { author: true, categories: { include: { category: true } } },
      })
    , 600),  // TTL 600s

    // 3. NEWEST — sắp theo updatedAt
    this.prisma.story.findMany({
      where: { deletedAt: null, publishedAt: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 16,
      include: { author: true, categories: { include: { category: true } } },
    }),

    // 4. POPULAR — sắp theo rating
    this.prisma.story.findMany({
      where: { deletedAt: null, publishedAt: { not: null }, ratingCount: { gt: 5 } },
      orderBy: { averageRating: "desc" },
      take: 16,
      include: { author: true, categories: { include: { category: true } } },
    }),
  ]);

  return { featured, trending, newest, popular };
}

1.3.2 — GET /stories/explore — Filter Động (Prisma WhereInput)
Đây là đoạn logic phức tạp nhất. Chúng ta xây dựng WhereInput động tùy thuộc vào query params, kết hợp FULLTEXT search với filter thông thường.

  // stories.service.ts — explore() với filter động
// src/stories/stories.service.ts
async explore(dto: ExploreQueryDto) {
  const {
    q, categorySlug, authorId, status,
    sort = "newest", page = 1, limit = 16
  } = dto;

  // ── Xây dựng WHERE clause động ──────────────────────
  const where: Prisma.StoryWhereInput = {
    deletedAt: null,
    publishedAt: { not: null },
  };

  // Full-text search — dùng MySQL FULLTEXT INDEX
  if (q?.trim()) {
    where.OR = [
      { title:       { search: q.trim().split(" ").join(" ") } },
      { description: { search: q.trim().split(" ").join(" ") } },
    ];
    // Lưu ý: Prisma fulltext cần @fulltext trong schema
    // Fallback dùng contains nếu không có fulltext:
    // where.OR = [{ title: { contains: q } }, { description: { contains: q } }]
  }

  // Filter theo thể loại (slug)
  if (categorySlug) {
    where.categories = {
      some: {
        category: { slug: categorySlug },
      },
    };
  }

  // Filter theo tác giả
  if (authorId) {
    where.authorId = authorId;
  }

  // Filter theo trạng thái
  if (status) {
    where.status = status as StoryStatus;
  }

  // ── Xây dựng ORDER BY động ──────────────────────────
  const orderBy: Prisma.StoryOrderByWithRelationInput =
    sort === "trending" ? { totalViews: "desc" }    :
    sort === "popular"  ? { averageRating: "desc" } :
    sort === "updated"  ? { updatedAt: "desc" }     :
    /* newest */          { publishedAt: "desc" };

  // ── Pagination ──────────────────────────────────────
  const skip  = (page - 1) * limit;
  const take  = Math.min(limit, 50); // giới hạn max 50

  // ── Chạy song song count + findMany ─────────────────
  const [total, items] = await this.prisma.$transaction([
    this.prisma.story.count({ where }),
    this.prisma.story.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        author:     { select: { id: true, name: true, slug: true } },
        categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
      hasNextPage: page * take < total,
    },
  };
}

1.3.3 — GET /stories/:slug — Story Detail
  // stories.service.ts — findBySlug()
// src/stories/stories.service.ts
async findBySlug(slug: string) {
  const story = await this.prisma.story.findUnique({
    where: { slug, deletedAt: null },
    include: {
      author: true,
      categories: {
        include: { category: true },
      },
      // Chỉ lấy 20 chapter đầu (danh sách còn lại fetch riêng)
      chapters: {
        where: { deletedAt: null, isPublished: true },
        orderBy: { chapterNumber: "asc" },
        take: 20,
        select: {
          id: true, title: true, chapterNumber: true,
          type: true, duration: true, unlocksAt: true,
          viewCount: true, createdAt: true,
          // KHÔNG trả r2AudioUrl / youtubeVideoId ở đây
          // FE phải gọi GET /chapters/:id để lấy URL phát
        },
      },
    },
  });

  if (!story) throw new NotFoundException(`Truyện "${slug}" không tồn tại`);
  return story;
}

1.3.4 — DTO Classes (class-validator)
  // dto/explore-query.dto.ts
// src/stories/dto/explore-query.dto.ts
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export enum SortOrder { newest = "newest", trending = "trending",
                         popular = "popular",  updated = "updated" }

export class ExploreQueryDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsString()
  categorySlug?: string;

  @IsOptional() @IsString()
  authorId?: string;

  @IsOptional() @IsEnum(["ongoing", "completed"])
  status?: "ongoing" | "completed";

  @IsOptional() @IsEnum(SortOrder)
  sort?: SortOrder = SortOrder.newest;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 16;
}

 
  PHẦN 2: FRONTEND ARCHITECTURE & STATE MANAGEMENT

2.1  Cấu trúc thư mục Next.js 14 (App Router)
  // Cấu trúc thư mục src/
src/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root Layout — gắn GlobalPlayer
│   ├── page.tsx                 # Trang chủ / Home
│   ├── kham-pha/                # Explore page
│   │   └── page.tsx
│   ├── truyen/                  # Story routes
│   │   └── [slug]/              # /truyen/ten-truyen
│   │       ├── page.tsx         # Story Detail
│   │       └── loading.tsx      # Skeleton UI
│   ├── the-loai/[slug]/page.tsx # Trang thể loại
│   ├── tac-gia/[slug]/page.tsx  # Trang tác giả
│   └── not-found.tsx
│
├── components/                  # Shared UI components
│   ├── ui/                      # Primitive: Button, Badge, Modal...
│   ├── layout/                  # Navbar, Footer, Sidebar
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── GlobalPlayer.tsx     # ⭐ Mount 1 lần trong layout.tsx
│   ├── story/                   # Story-related components
│   │   ├── StoryCard.tsx        # Card hiển thị truyện
│   │   ├── StoryRow.tsx         # Hàng truyện với title + scroll
│   │   ├── StoryGrid.tsx        # Grid phân trang
│   │   ├── HeroBanner.tsx       # Banner slideshow trang chủ
│   │   ├── CategoryChip.tsx     # Badge thể loại
│   │   └── StoryDetailInfo.tsx  # Block thông tin chi tiết truyện
│   ├── explore/                 # Explore-specific
│   │   ├── FilterBar.tsx        # Bộ lọc: Category/Author/Status/Sort
│   │   ├── FilterTag.tsx        # Tag có nút xóa
│   │   └── ExploreGrid.tsx
│   ├── player/                  # Audio Player components
│   │   ├── GlobalPlayer.tsx     # ⭐ Mini player sticky
│   │   ├── FullPlayer.tsx       # Player mở rộng
│   │   ├── ChapterList.tsx      # Danh sách chương
│   │   ├── ChapterItem.tsx      # 1 item chương
│   │   └── ProgressBar.tsx      # Thanh progress có thể seek
│   └── common/                  # Shared: Skeleton, Pagination, Modal
│
├── hooks/                       # Custom React Hooks
│   ├── useStories.ts            # Fetch stories (React Query)
│   ├── useHomeData.ts
│   ├── useExplore.ts            # Filter + pagination
│   ├── useStoryDetail.ts
│   ├── useChapters.ts
│   └── useAudioSync.ts          # Đồng bộ HTML5 Audio <-> Zustand
│
├── stores/                      # Zustand stores
│   ├── audioStore.ts            # ⭐ Global audio state
│   └── userStore.ts             # User session
│
├── lib/                         # Utilities
│   ├── axios.ts                 # Axios instance + interceptors
│   ├── queryClient.ts           # React Query config
│   └── utils.ts                 # formatTime, slugify...
│
└── types/                       # TypeScript interfaces
    ├── story.types.ts
    ├── chapter.types.ts
    └── audio.types.ts


2.2  Zustand Audio Store — useAudioStore
Đây là trái tim của toàn bộ hệ thống phát audio. Store này được thiết kế để: (1) lưu trạng thái phát nhạc toàn cục, (2) không bị reset khi chuyển trang, (3) đồng bộ với thẻ <audio> HTML5 thực sự bằng useEffect trong GlobalPlayer.

2.2.1 — Interface Definition
  // types/audio.types.ts — Interface
// src/types/audio.types.ts
export interface ChapterInfo {
  id:            string;
  storyId:       string;
  storyTitle:    string;
  storySlug:     string;
  thumbnailUrl:  string;
  chapterNumber: number;
  title:         string;
  r2AudioUrl:    string | null;    // URL Cloudflare R2
  youtubeVideoId: string | null;  // YouTube Video ID
  duration:      number;           // Giây (0 nếu chưa load)
}

export interface AudioState {
  // ── Dữ liệu ──────────────────────────
  currentChapter: ChapterInfo | null;
  playlist:       ChapterInfo[];   // Toàn bộ chương của story đang nghe

  // ── Trạng thái phát ──────────────────
  isPlaying:   boolean;
  isLoading:   boolean;            // Đang load audio
  hasError:    boolean;

  // ── Vị trí & thời gian ───────────────
  currentTime: number;             // Giây hiện tại
  duration:    number;             // Tổng thời gian (giây)
  progress:    number;             // 0–100 (phần trăm)

  // ── Cài đặt ──────────────────────────
  volume:      number;             // 0–1
  playbackRate: number;            // 0.75 | 1 | 1.25 | 1.5 | 2
  isMuted:     boolean;
  isRepeat:    boolean;
  isShuffle:   boolean;

  // ── UI State ─────────────────────────
  isPlayerVisible: boolean;        // Hiển thị mini player
  isExpanded:      boolean;        // Mở full player
}

2.2.2 — Store Implementation (Zustand)
  // stores/audioStore.ts — Zustand store hoàn chỉnh
// src/stores/audioStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AudioState, ChapterInfo } from "@/types/audio.types";

interface AudioActions {
  // Phát 1 chương cụ thể
  playChapter:  (chapter: ChapterInfo, playlist?: ChapterInfo[]) => void;
  // Dừng / tiếp tục
  togglePlay:   () => void;
  // Chuyển chương
  nextChapter:  () => void;
  prevChapter:  () => void;
  // Seek đến giây cụ thể (gọi từ ProgressBar)
  seek:         (seconds: number) => void;
  // Cập nhật từ sự kiện HTML5 Audio (gọi từ useAudioSync hook)
  setCurrentTime: (time: number, duration: number) => void;
  setIsPlaying:   (playing: boolean) => void;
  setIsLoading:   (loading: boolean) => void;
  setHasError:    (error: boolean) => void;
  // Cài đặt
  setVolume:      (v: number) => void;
  setPlaybackRate:(r: number) => void;
  toggleMute:     () => void;
  toggleRepeat:   () => void;
  toggleShuffle:  () => void;
  toggleExpanded: () => void;
  closePlayer:    () => void;
}

const INITIAL_STATE: AudioState = {
  currentChapter:  null,
  playlist:        [],
  isPlaying:       false,
  isLoading:       false,
  hasError:        false,
  currentTime:     0,
  duration:        0,
  progress:        0,
  volume:          0.8,
  playbackRate:    1,
  isMuted:         false,
  isRepeat:        false,
  isShuffle:       false,
  isPlayerVisible: false,
  isExpanded:      false,
};

export const useAudioStore = create<AudioState & AudioActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ── playChapter ──────────────────────────────────
      playChapter: (chapter, playlist) => {
        const currentId = get().currentChapter?.id;
        if (currentId === chapter.id) {
          // Cùng chương → toggle play
          set({ isPlaying: !get().isPlaying });
          return;
        }
        set({
          currentChapter:  chapter,
          playlist:        playlist ?? get().playlist,
          isPlaying:       true,
          isLoading:       true,
          hasError:        false,
          currentTime:     0,
          duration:        0,
          progress:        0,
          isPlayerVisible: true,
        });
      },

      // ── togglePlay ───────────────────────────────────
      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

      // ── nextChapter ──────────────────────────────────
      nextChapter: () => {
        const { currentChapter, playlist, isShuffle, isRepeat } = get();
        if (!currentChapter || playlist.length === 0) return;
        const idx = playlist.findIndex((c) => c.id === currentChapter.id);
        let nextIdx: number;
        if (isRepeat)  { nextIdx = idx; }
        else if (isShuffle) { nextIdx = Math.floor(Math.random() * playlist.length); }
        else { nextIdx = idx + 1; }
        if (nextIdx >= playlist.length) {
          set({ isPlaying: false });  // Hết playlist
          return;
        }
        get().playChapter(playlist[nextIdx], playlist);
      },

      // ── prevChapter ──────────────────────────────────
      prevChapter: () => {
        const { currentChapter, playlist } = get();
        if (!currentChapter) return;
        const idx = playlist.findIndex((c) => c.id === currentChapter.id);
        if (idx > 0) get().playChapter(playlist[idx - 1], playlist);
      },

      // ── seek ─────────────────────────────────────────
      // Chỉ cập nhật store; HTML5 Audio sẽ được điều khiển
      // bởi useAudioSync hook khi detect thay đổi seekTarget
      seek: (seconds) => {
        const dur = get().duration;
        const clamped = Math.max(0, Math.min(seconds, dur));
        set({
          currentTime: clamped,
          progress: dur > 0 ? (clamped / dur) * 100 : 0,
          seekTarget: clamped,   // flag để useAudioSync detect
        } as any);
      },

      // ── Cập nhật từ HTML5 Audio events ───────────────
      setCurrentTime: (time, duration) => set({
        currentTime: time,
        duration,
        progress: duration > 0 ? (time / duration) * 100 : 0,
      }),
      setIsPlaying:  (isPlaying)  => set({ isPlaying }),
      setIsLoading:  (isLoading)  => set({ isLoading }),
      setHasError:   (hasError)   => set({ hasError, isLoading: false }),

      // ── Cài đặt ──────────────────────────────────────
      setVolume:       (volume)       => set({ volume, isMuted: volume === 0 }),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
      toggleMute:      () => set((s)  => ({ isMuted: !s.isMuted })),
      toggleRepeat:    () => set((s)  => ({ isRepeat: !s.isRepeat })),
      toggleShuffle:   () => set((s)  => ({ isShuffle: !s.isShuffle })),
      toggleExpanded:  () => set((s)  => ({ isExpanded: !s.isExpanded })),
      closePlayer:     () => set({ isPlayerVisible: false, isPlaying: false }),
    }),
    {
      name: "audio-store",
      storage: createJSONStorage(() => localStorage),
      // Chỉ persist cài đặt, KHÔNG persist trạng thái phát
      partialize: (state) => ({
        volume:       state.volume,
        playbackRate: state.playbackRate,
        isMuted:      state.isMuted,
        isRepeat:     state.isRepeat,
        isShuffle:    state.isShuffle,
        // currentChapter & isPlaying KHÔNG persist
        // → Tránh hydration mismatch khi SSR
      }),
    }
  )
);

 
  PHẦN 3: FRONTEND IMPLEMENTATION (NEXT.JS UI/UX)

3.1  Trang Chủ (Home Page) & Trang Khám Phá (Explore)

3.1.1 — StoryCard Component
StoryCard là component tái sử dụng dùng cho tất cả màn hình. Nhận vào một Story object, render thumbnail, badge, rating, view count.
  // components/story/StoryCard.tsx
// src/components/story/StoryCard.tsx
"use client";
import Image from "next/image";
import Link from "next/link";
import { Eye, Star, BookOpen } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { StoryCard as StoryCardType } from "@/types/story.types";

interface Props { story: StoryCardType; }

export function StoryCard({ story }: Props) {
  return (
    <Link href={`/truyen/${story.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-lg aspect-[2/3] bg-gray-100">
        <Image
          src={story.thumbnailUrl ?? "/placeholder.jpg"}
          alt={story.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {/* Badge: NEW | FULL */}
        <div className="absolute top-2 left-2 flex gap-1">
          {story.status === "completed" && (
            <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">FULL</span>
          )}
        </div>
        {/* Gradient overlay bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        {/* Lượt nghe */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs">
          <Eye size={12} /><span>{formatNumber(story.totalViews)}</span>
        </div>
        {/* Rating */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-yellow-400 text-xs">
          <Star size={12} fill="currentColor" /><span>{story.averageRating.toFixed(1)}</span>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-blue-600 transition-colors">
          {story.title}
        </h3>
        <p className="text-xs text-gray-500">{story.author.name}</p>
        {/* Categories */}
        <div className="flex flex-wrap gap-1">
          {story.categories.slice(0, 2).map((c) => (
            <span key={c.id} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded">
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

3.1.2 — FilterBar Component (Explore)
FilterBar sync state với URL search params để hỗ trợ deep link và back button. Dùng useRouter và useSearchParams của Next.js.
  // components/explore/FilterBar.tsx
// src/components/explore/FilterBar.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

interface FilterBarProps {
  categories: { id: number; name: string; slug: string }[];
  authors:    { id: string; name: string }[];
}

export function FilterBar({ categories, authors }: FilterBarProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Đọc state hiện tại từ URL
  const currentCategory = searchParams.get("categorySlug") ?? "";
  const currentStatus   = searchParams.get("status") ?? "";
  const currentSort     = searchParams.get("sort") ?? "newest";
  const currentQ        = searchParams.get("q") ?? "";

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) { params.set(key, value); }
    else       { params.delete(key); }
    params.set("page", "1"); // Reset về trang 1 khi filter thay đổi
    router.push(`/kham-pha?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  return (
    <div className="flex flex-wrap gap-3 items-center p-4 bg-white rounded-xl shadow-sm border">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          defaultValue={currentQ}
          placeholder="Tìm truyện..."
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") updateFilter("q", e.currentTarget.value);
          }}
        />
      </div>
      {/* Thể loại */}
      <select
        value={currentCategory}
        onChange={(e) => updateFilter("categorySlug", e.target.value)}
        className="px-3 py-2 border rounded-lg text-sm text-gray-700 bg-white"
      >
        <option value="">Tất cả thể loại</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>{c.name}</option>
        ))}
      </select>
      {/* Trạng thái */}
      <select
        value={currentStatus}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="px-3 py-2 border rounded-lg text-sm text-gray-700 bg-white"
      >
        <option value="">Tất cả trạng thái</option>
        <option value="ongoing">Đang cập nhật</option>
        <option value="completed">Hoàn thành</option>
      </select>
      {/* Sắp xếp */}
      <select
        value={currentSort}
        onChange={(e) => updateFilter("sort", e.target.value)}
        className="px-3 py-2 border rounded-lg text-sm text-gray-700 bg-white"
      >
        <option value="newest">Mới nhất</option>
        <option value="trending">Thịnh hành</option>
        <option value="popular">Phổ biến nhất</option>
        <option value="updated">Mới cập nhật</option>
      </select>
    </div>
  );
}

3.1.3 — Explore Page — Kết nối API + Pagination
  // app/kham-pha/page.tsx + ExploreGrid.tsx
// src/app/kham-pha/page.tsx  (Server Component)
import { Suspense } from "react";
import { FilterBar } from "@/components/explore/FilterBar";
import { ExploreGrid } from "@/components/explore/ExploreGrid";
import { getCategories } from "@/lib/api/categories";

interface Props {
  searchParams: {
    q?: string; categorySlug?: string; status?: string;
    sort?: string; page?: string;
  };
}

export default async function ExplorePage({ searchParams }: Props) {
  const categories = await getCategories(); // Fetch từ NestJS API

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Khám phá truyện</h1>
      <Suspense fallback={<div>Đang tải bộ lọc...</div>}>
        <FilterBar categories={categories} authors={[]} />
      </Suspense>
      <div className="mt-6">
        {/* ExploreGrid là Client Component, nhận searchParams */}
        <ExploreGrid searchParams={searchParams} />
      </div>
    </main>
  );
}

// src/components/explore/ExploreGrid.tsx  (Client Component)
"use client";
import { useExplore } from "@/hooks/useExplore";
import { StoryCard } from "@/components/story/StoryCard";
import { Pagination } from "@/components/common/Pagination";
import { StoryCardSkeleton } from "@/components/common/Skeleton";

export function ExploreGrid({ searchParams }: { searchParams: any }) {
  const { data, isLoading } = useExplore(searchParams);

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: 16 }).map((_, i) => <StoryCardSkeleton key={i} />)}
  </div>;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {data?.items.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
      {data?.pagination && (
        <Pagination
          total={data.pagination.totalPages}
          current={data.pagination.page}
          className="mt-8"
        />
      )}
    </>
  );
}


3.2  Story Detail Page

3.2.1 — Layout & Tabs
  // app/truyen/[slug]/page.tsx
// src/app/truyen/[slug]/page.tsx  (Server Component)
import { getStoryBySlug } from "@/lib/api/stories";
import { notFound }        from "next/navigation";
import { StoryDetailInfo } from "@/components/story/StoryDetailInfo";
import { ChapterList }     from "@/components/player/ChapterList";

export async function generateMetadata({ params }: Props) {
  const story = await getStoryBySlug(params.slug);
  if (!story) return {};
  return {
    title: `${story.title} | Web Truyện Audio`,
    description: story.description?.slice(0, 160),
    openGraph: {
      images: [story.thumbnailUrl],
      type: "book",
    },
  };
}

export default async function StoryDetailPage({ params }: { params: { slug: string } }) {
  const story = await getStoryBySlug(params.slug);
  if (!story) notFound();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cột trái — Thông tin truyện */}
        <div className="lg:col-span-1">
          <StoryDetailInfo story={story} />
        </div>
        {/* Cột phải — Tab Giới thiệu / Danh sách chương */}
        <div className="lg:col-span-2">
          <ChapterList story={story} initialChapters={story.chapters} />
        </div>
      </div>
    </main>
  );
}

3.2.2 — Nút "Nghe Ngay" → Trigger Zustand Store
  // components/player/ChapterList.tsx
// src/components/player/ChapterList.tsx
"use client";
import { useState } from "react";
import { useAudioStore } from "@/stores/audioStore";
import { ChapterItem } from "./ChapterItem";
import { Play, List } from "lucide-react";

export function ChapterList({ story, initialChapters }) {
  const [tab, setTab] = useState<"intro" | "chapters">("chapters");
  const { playChapter, currentChapter } = useAudioStore();

  // Map chapters sang ChapterInfo (thêm story metadata)
  const chapterInfos = initialChapters.map((c) => ({
    ...c,
    storyId:    story.id,
    storyTitle: story.title,
    storySlug:  story.slug,
    thumbnailUrl: story.thumbnailUrl ?? "",
  }));

  const handlePlayFirst = () => {
    if (chapterInfos.length > 0) {
      playChapter(chapterInfos[0], chapterInfos);
    }
  };

  return (
    <div>
      {/* Nút CTA */}
      <button
        onClick={handlePlayFirst}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6
                   rounded-xl font-semibold flex items-center justify-center gap-2
                   transition-colors mb-6"
      >
        <Play size={20} fill="white" /> Nghe ngay
      </button>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        {[["intro", "Giới thiệu"], ["chapters", "Danh sách chương"]].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Nội dung tab */}
      {tab === "intro" && (
        <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap">
          {story.description}
        </p>
      )}
      {tab === "chapters" && (
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {chapterInfos.map((chapter) => (
            <ChapterItem
              key={chapter.id}
              chapter={chapter}
              isActive={currentChapter?.id === chapter.id}
              onPlay={() => playChapter(chapter, chapterInfos)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


3.3  Global Audio Player (Core Feature)

⭐ Nguyên lý hoạt động
GlobalPlayer được mount 1 lần duy nhất trong layout.tsx. Component này chứa thẻ <audio> HTML5 thực sự. Zustand Store là nguồn dữ liệu (source of truth). useAudioSync hook chạy useEffect để đồng bộ 2 chiều: store → audio element và audio events → store.

3.3.1 — Gắn GlobalPlayer vào layout.tsx
  // app/layout.tsx — Mount GlobalPlayer đúng cách
// src/app/layout.tsx
import { GlobalPlayer } from "@/components/layout/GlobalPlayer";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 text-gray-900">
        <Navbar />
        {/* Nội dung các trang — children thay đổi, GlobalPlayer không bị unmount */}
        <div className="pb-24">  {/* padding bottom để tránh bị Mini Player che */}
          {children}
        </div>
        <Footer />
        {/* ⭐ Mount 1 lần — không bao giờ unmount khi chuyển trang */}
        <GlobalPlayer />
      </body>
    </html>
  );
}

// ⚠️ GlobalPlayer PHẢI là "use client" directive
// ⚠️ KHÔNG đặt GlobalPlayer bên trong các page component
// ⚠️ KHÔNG dùng conditional render dựa theo route

3.3.2 — GlobalPlayer Component + useAudioSync Hook (Code đầy đủ)
  // components/layout/GlobalPlayer.tsx — Xử lý tất cả HTML5 Audio events
// src/components/layout/GlobalPlayer.tsx
"use client";
import { useEffect, useRef } from "react";
import { useAudioStore }     from "@/stores/audioStore";
import { MiniPlayerUI }      from "@/components/player/MiniPlayerUI";

export function GlobalPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekTargetRef = useRef<number | null>(null);

  const {
    currentChapter, isPlaying, volume, playbackRate,
    isMuted, setCurrentTime, setIsPlaying, setIsLoading,
    setHasError, nextChapter,
  } = useAudioStore();

  // ── Effect 1: Khởi tạo audio element 1 lần ───────────
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    // ── Bind tất cả event listeners ─────────────────

    // Cập nhật vị trí realtime (throttle tự nhiên ~4fps)
    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime, audio.duration || 0);
    });

    // Khi metadata load xong → biết duration
    audio.addEventListener("loadedmetadata", () => {
      setCurrentTime(0, audio.duration || 0);
      setIsLoading(false);
      if (useAudioStore.getState().isPlaying) {
        audio.play().catch(console.error);
      }
    });

    // Khi hết chương → tự động next
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      nextChapter();           // Zustand action → sẽ trigger Effect 2
    });

    // Khi đang buffer
    audio.addEventListener("waiting", () => setIsLoading(true));
    audio.addEventListener("canplay",  () => setIsLoading(false));

    // Xử lý lỗi
    audio.addEventListener("error", () => {
      setHasError(true);
      setIsLoading(false);
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []); // ⚠️ Empty deps — chỉ chạy 1 lần

  // ── Effect 2: Sync khi currentChapter thay đổi ────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentChapter) return;

    const url = currentChapter.r2AudioUrl;
    if (!url) return; // Chapter YouTube — không handle ở đây

    setIsLoading(true);
    audio.src          = url;
    audio.currentTime  = 0;
    audio.load();
    // Việc play() được thực hiện trong loadedmetadata event
  }, [currentChapter?.id]); // ⚠️ Chỉ depend vào ID

  // ── Effect 3: Sync isPlaying → play()/pause() ──────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.play().catch(() => setIsPlaying(false)); }
    else           { audio.pause(); }
  }, [isPlaying]);

  // ── Effect 4: Sync volume & mute ────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // ── Effect 5: Sync playback rate ────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  // ── Effect 6: Seek khi store.seekTarget thay đổi ────────
  useEffect(() => {
    const unsub = useAudioStore.subscribe(
      (state: any) => state.seekTarget,
      (seekTarget: number | null) => {
        if (seekTarget !== null && audioRef.current) {
          audioRef.current.currentTime = seekTarget;
        }
      }
    );
    return unsub;
  }, []);

  return <MiniPlayerUI audioRef={audioRef} />;
}

3.3.3 — MiniPlayerUI Component (Sticky Bar)
  // components/player/MiniPlayerUI.tsx
// src/components/player/MiniPlayerUI.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { Play, Pause, SkipForward, SkipBack, X } from "lucide-react";
import { useAudioStore } from "@/stores/audioStore";
import { ProgressBar }   from "./ProgressBar";

export function MiniPlayerUI({ audioRef }: { audioRef: any }) {
  const {
    currentChapter, isPlaying, isLoading, progress,
    currentTime, duration, isPlayerVisible,
    togglePlay, nextChapter, prevChapter, seek, closePlayer,
  } = useAudioStore();

  if (!isPlayerVisible || !currentChapter) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-2xl
                    h-20 flex items-center px-4 gap-3">
      {/* Thumbnail + Info */}
      <Link href={`/truyen/${currentChapter.storySlug}`} className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
          <Image src={currentChapter.thumbnailUrl} alt="" fill className="object-cover" />
          {isLoading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{currentChapter.storyTitle}</p>
          <p className="text-xs text-gray-500 truncate">{currentChapter.title}</p>
        </div>
      </Link>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button onClick={prevChapter} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <SkipBack size={18} />
        </button>
        <button
          onClick={togglePlay}
          className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
        >
          {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
        </button>
        <button onClick={nextChapter} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <SkipForward size={18} />
        </button>
      </div>

      {/* Progress (ẩn trên mobile nhỏ) */}
      <div className="hidden sm:flex items-center gap-2 flex-1 max-w-48">
        <span className="text-xs text-gray-400 w-8 text-right">{formatTime(currentTime)}</span>
        <ProgressBar
          progress={progress}
          duration={duration}
          onSeek={seek}
          className="flex-1"
        />
        <span className="text-xs text-gray-400 w-8">{formatTime(duration)}</span>
      </div>

      {/* Close */}
      <button onClick={closePlayer} className="p-2 hover:bg-gray-100 rounded-full ml-1">
        <X size={16} />
      </button>
    </div>
  );
}

 
  PHẦN 4: LƯU Ý KỸ THUẬT & TỐI ƯU (EDGE CASES)

4.1  Xử lý Hydration Error với Zustand Persist + Next.js SSR
Đây là vấn đề phổ biến nhất khi dùng Zustand Persist với Next.js App Router. Server render ra HTML không có data localStorage, client hydrate với data khác → React throw Hydration Error.

⚠️ Vấn đề
Zustand persist đọc localStorage tại thời điểm client-side khởi tạo. Server không có localStorage → giá trị ban đầu khác nhau giữa Server và Client → React warning "Text content did not match".

4.1.1 — Giải pháp: useHydrated Hook + skipHydration
  // hooks/useHydrated.ts — Giải pháp Hydration Error
// src/hooks/useHydrated.ts
import { useEffect, useState } from "react";

// Hook này trả về false khi SSR, true sau khi client mount
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}

// ─────────────────────────────────────────────────────────
// Cách dùng trong GlobalPlayer.tsx
// ─────────────────────────────────────────────────────────
"use client";
import { useHydrated } from "@/hooks/useHydrated";

export function GlobalPlayer() {
  const hydrated = useHydrated();

  // Không render cho đến khi client đã mount
  // → Tránh hoàn toàn hydration mismatch
  if (!hydrated) return null;

  return <GlobalPlayerInner />;
}

// ─────────────────────────────────────────────────────────
// HOẶC: Dùng skipHydration trong store config
// ─────────────────────────────────────────────────────────
export const useAudioStore = create<...>()(persist(
  (set, get) => ({ ...INITIAL_STATE, ...actions }),
  {
    name: "audio-store",
    // skipHydration: true → store không tự rehydrate
    // Ta gọi thủ công sau khi component mount
    skipHydration: true,
  }
));

// Gọi rehydrate thủ công trong 1 "use client" component ở layout.tsx
useEffect(() => {
  useAudioStore.persist.rehydrate();
}, []);


4.2  Responsive Mini Player trên Mobile
Mini Player cần hiển thị đẹp trên mọi màn hình. Chiến lược: luôn hiện controls cơ bản, ẩn progress bar trên màn nhỏ, dùng bottom safe area trên iOS.
  // Responsive Mini Player — Tailwind breakpoints
// Tailwind breakpoint strategy cho MiniPlayerUI
// ─────────────────────────────────────────────

// Mobile (< 640px): Chỉ hiện Thumbnail + Title + Play/Pause + Next
// Tablet (640–768px): Thêm progress bar
// Desktop (> 768px): Đầy đủ tất cả controls

<div className={[
  "fixed bottom-0 left-0 right-0 z-50",
  "bg-white/95 backdrop-blur-md border-t shadow-2xl",
  "h-16 sm:h-20",                  // chiều cao khác nhau
  "pb-safe",                       // iOS safe area (plugin tailwindcss-safe-area)
  "flex items-center px-3 sm:px-4 gap-2 sm:gap-3",
].join(" ")}
>
  {/* Thumbnail — nhỏ hơn trên mobile */}
  <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden shrink-0">
    ...
  </div>

  {/* Info — flex-1 để chiếm không gian còn lại */}
  <div className="flex-1 min-w-0">
    <p className="text-xs sm:text-sm font-semibold truncate">{storyTitle}</p>
    <p className="text-[10px] sm:text-xs text-gray-500 truncate">{chapterTitle}</p>
    {/* Progress bar ngay dưới info trên mobile */}
    <div className="mt-1 sm:hidden">
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  </div>

  {/* Controls */}
  {/* SkipBack ẩn trên mobile nhỏ */}
  <button className="hidden sm:block p-1.5 hover:bg-gray-100 rounded-full">
    <SkipBack size={16} />
  </button>
  <button className="p-2.5 sm:p-3 bg-blue-600 text-white rounded-full">
    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
  </button>
  <button className="p-1.5 hover:bg-gray-100 rounded-full">
    <SkipForward size={16} />
  </button>

  {/* Progress bar đầy đủ — ẩn trên mobile */}
  <div className="hidden sm:flex items-center gap-2 flex-1 max-w-40 md:max-w-64">
    ...
  </div>
</div>


4.3  Xử lý Lỗi Load Audio & Mạng Chậm
Người dùng có thể gặp nhiều loại lỗi: CDN R2 quá tải, link hỏng, mạng chậm. Cần xử lý từng tình huống với UX thân thiện.
  // GlobalPlayer.tsx — Xử lý lỗi audio nâng cao
// Các lỗi HTML5 Audio MediaError cần handle:
// MEDIA_ERR_ABORTED = 1   — User abort
// MEDIA_ERR_NETWORK = 2   — Network error (mạng chậm, CDN down)
// MEDIA_ERR_DECODE  = 3   — File corrupted / unsupported codec
// MEDIA_ERR_SRC_NOT_FOUND = 4 — URL không tồn tại (link hỏng)

// src/components/layout/GlobalPlayer.tsx — Error handling nâng cao
audio.addEventListener("error", (e) => {
  const err = audio.error;
  let message = "Không thể phát audio";

  if (err) {
    switch (err.code) {
      case 2: message = "Lỗi kết nối mạng — đang thử lại..."; break;
      case 3: message = "File audio bị lỗi — vui lòng báo cáo"; break;
      case 4: message = "Link audio không tồn tại"; break;
    }
  }

  // Retry logic cho network error (code 2)
  if (err?.code === 2) {
    const retryCount = retryRef.current;
    if (retryCount < 3) {
      retryRef.current++;
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      setTimeout(() => {
        audio.load();
        if (useAudioStore.getState().isPlaying) audio.play();
      }, delay);
      return; // Chưa set error
    }
  }

  retryRef.current = 0;
  setHasError(true);
  setIsLoading(false);
  // Toast notification cho user
  toast.error(message, { duration: 5000 });
});

// ── Hiển thị lỗi trong MiniPlayerUI ───────────────────────
{hasError && (
  <div className="absolute inset-0 bg-red-50 flex items-center justify-center gap-2
                  text-red-600 text-xs font-medium">
    <AlertCircle size={14} />
    <span>Lỗi audio</span>
    <button
      onClick={() => { setHasError(false); /* retry */ audio.load(); }}
      className="underline ml-1"
    >
      Thử lại
    </button>
  </div>
)}

// ── Skeleton loading khi isLoading ────────────────────────
{isLoading && !hasError && (
  <div className="absolute bottom-0 left-0 right-0 h-0.5">
    <div className="h-full bg-blue-400 animate-pulse w-full" />
  </div>
)}


4.4  Tối ưu Performance & SEO

4.4.1 — React Query Configuration (Axios + Cache)
  // lib/axios.ts + lib/queryClient.ts
// src/lib/axios.ts — Axios instance với interceptors
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + "/api/v1",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — gắn JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — auto refresh token
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      const { data } = await api.post("/auth/refresh", { refreshToken });
      localStorage.setItem("access_token", data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    }
    return Promise.reject(error);
  }
);

// src/lib/queryClient.ts — React Query config
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        5 * 60 * 1000,  // 5 phút
      gcTime:          10 * 60 * 1000,  // 10 phút
      retry:            2,
      refetchOnWindowFocus: false,
    },
  },
});

4.4.2 — Custom Hooks (useHomeData, useExplore)
  // hooks/useHomeData.ts + useExplore.ts
// src/hooks/useHomeData.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export function useHomeData() {
  return useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      const { data } = await api.get("/stories/home");
      return data.data;
    },
    staleTime: 3 * 60 * 1000, // 3 phút — trang chủ cache ngắn hơn
  });
}

// src/hooks/useExplore.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export function useExplore(searchParams: Record<string, string>) {
  return useQuery({
    // queryKey bao gồm toàn bộ searchParams
    // → React Query tự cache theo từng combination filter
    queryKey: ["explore", searchParams],
    queryFn: async () => {
      const { data } = await api.get("/stories/explore", { params: searchParams });
      return data.data;
    },
    placeholderData: (prev) => prev, // Giữ data cũ khi đang fetch
  });
}


4.4.3 — Checklist triển khai Production
Hạng mục	Giải pháp	Priority
CORS NestJS	app.enableCors({ origin: FRONTEND_URL })	🔴 Cao
ENV Variables	DATABASE_URL, R2_*, JWT_SECRET tách .env.local	🔴 Cao
Prisma Migrate	npx prisma migrate deploy trước khi deploy	🔴 Cao
Image Domain	next.config.js → images.remotePatterns R2 domain	🔴 Cao
Rate Limiting	@nestjs/throttler — max 100 req/min/IP	🟡 TB
Compression	NestJS compression middleware (gzip)	🟡 TB
PM2 Cluster	ecosystem.config.js — instances: "max"	🟡 TB
React Query SSR	dehydrate + HydrationBoundary trong Server Components	🟡 TB
Zustand DevTools	Tắt devtools trong production build	🟢 Thấp
PWA Manifest	next-pwa với workbox runtime caching	🟢 Thấp


📌 Tóm tắt kiến trúc luồng Audio
1. User bấm "Nghe ngay" / click ChapterItem 2. ChapterList gọi useAudioStore.playChapter(chapter, playlist) 3. Zustand store cập nhật currentChapter, isPlaying=true, isLoading=true 4. GlobalPlayer (Effect 2) detect currentChapter.id thay đổi → audio.src = r2AudioUrl → audio.load() 5. HTML5 Audio fire "loadedmetadata" → setCurrentTime(0, duration) → setIsLoading(false) → audio.play() 6. HTML5 Audio fire "timeupdate" 4fps → setCurrentTime(currentTime, duration) → store.progress cập nhật 7. MiniPlayerUI re-render ProgressBar theo store.progress 8. User seek → ProgressBar gọi store.seek(seconds) → Effect 6 detect seekTarget → audio.currentTime = seconds 9. Khi hết chương → "ended" event → store.nextChapter() → lặp lại từ bước 2