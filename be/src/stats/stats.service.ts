import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VipChapterAccessFilter, VipChapterSortBy, VipChapterSortOrder, VipChapterStatsQueryDto } from './dto/vip-chapter-stats-query.dto';
import { TopStoriesQueryDto } from './dto/top-stories-query.dto';

export enum TopStoryMetric {
  reads = 'reads',
  rating = 'rating',
  comments = 'comments',
  favorites = 'favorites',
  gifts = 'gifts',
  trending = 'trending',
  revenue = 'revenue',
  audio = 'audio',
}

@Injectable()
export class StatsService {
    constructor(private readonly prisma: PrismaService) { }

    async getOverviewStats() {
        const [totalUsers, totalStories, revenueAggregate] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.story.count(),
            this.prisma.payment.aggregate({
                _sum: {
                    amountVnd: true,
                },
                where: {
                    status: 'SUCCESS',
                },
            }),
        ]);

        return {
            totalUsers,
            totalStories,
            totalRevenue: revenueAggregate._sum.amountVnd || 0,
        };
    }

    async getVipChapterStats(query: VipChapterStatsQueryDto) {
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 20, 100);
        const search = query.search?.trim();
        const accessType = query.accessType ?? VipChapterAccessFilter.all;
        const sortBy = query.sortBy ?? VipChapterSortBy.credits;
        const sortOrder = query.sortOrder ?? VipChapterSortOrder.desc;

        const chapterAccessWhere: Prisma.ChapterWhereInput = {
            deletedAt: null,
            ...(accessType === VipChapterAccessFilter.all
                ? { accessType: { in: ['vip', 'timed'] } }
                : { accessType }),
        };

        const where: Prisma.StoryWhereInput = {
            deletedAt: null,
            chapters: { some: chapterAccessWhere },
            ...(search
                ? {
                    OR: [
                        { title: { contains: search } },
                        { slug: { contains: search } },
                        { author: { name: { contains: search } } },
                    ],
                }
                : {}),
        };

        const stories = await this.prisma.story.findMany({
            where,
            select: {
                id: true,
                title: true,
                slug: true,
                thumbnailUrl: true,
                totalViews: true,
                createdAt: true,
                author: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                chapters: {
                    where: chapterAccessWhere,
                    select: {
                        id: true,
                        chapterNumber: true,
                        title: true,
                        accessType: true,
                        unlockPrice: true,
                        updatedAt: true,
                        viewCount: true,
                        unlocksAt: true,
                    },
                    orderBy: { chapterNumber: 'asc' },
                },
            },
        });

        // Lấy tất cả chapterId để query sổ cái một lần (tránh N+1)
        const allChapterIds = stories.flatMap((s) => s.chapters.map((c) => c.id));

        // Query bảng UserChapterUnlock: COUNT và SUM(pulseAmount) theo chapterId + unlockType
        const unlockAgg = allChapterIds.length > 0
            ? await this.prisma.$queryRaw<Array<{
                chapter_id: string;
                unlock_type: string;
                open_count: bigint;
                pulse_sum: bigint;
            }>>`
                SELECT chapter_id, unlock_type,
                       COUNT(id) AS open_count,
                       SUM(pulse_amount) AS pulse_sum
                FROM user_chapter_unlocks
                WHERE chapter_id IN (${Prisma.join(allChapterIds)})
                GROUP BY chapter_id, unlock_type
            `
            : [];

        // Build lookup map: chapterId -> { vipCount, timedCount, pulseCount, pulseSum }
        const unlockMap = new Map<string, { vipCount: number; timedCount: number; pulseCount: number; pulseSum: number }>();
        for (const row of unlockAgg) {
            const entry = unlockMap.get(row.chapter_id) ?? { vipCount: 0, timedCount: 0, pulseCount: 0, pulseSum: 0 };
            const count = Number(row.open_count ?? 0);
            const sum = Number(row.pulse_sum ?? 0);
            if (row.unlock_type === 'VIP') entry.vipCount += count;
            else if (row.unlock_type === 'TIMED') entry.timedCount += count;
            else if (row.unlock_type === 'PULSE') { entry.pulseCount += count; entry.pulseSum += sum; }
            unlockMap.set(row.chapter_id, entry);
        }

        const rows = stories.map((story) => {
            const chapters = story.chapters.map((chapter) => ({
                id: chapter.id,
                chapterNumber: chapter.chapterNumber,
                title: chapter.title,
                accessType: chapter.accessType,
                unlockPrice: chapter.unlockPrice,
                updatedAt: chapter.updatedAt,
                viewCount: Number(chapter.viewCount || 0),
                unlocksAt: chapter.unlocksAt,
            }));

            const vipChapters = chapters.filter((c) => c.accessType === 'vip');
            const timedChapters = chapters.filter((c) => c.accessType === 'timed');

            // Tính từ sổ cái thực tế
            let vipOpenCount = 0;
            let timedOpenCount = 0;
            let totalCredits = 0; // Pulse thực thu (Phương án A)

            for (const chapter of chapters) {
                const stats = unlockMap.get(chapter.id);
                if (!stats) continue;
                vipOpenCount += stats.vipCount;
                timedOpenCount += stats.timedCount;
                totalCredits += stats.pulseSum;
            }

            const totalOpenCount = vipOpenCount + timedOpenCount +
                chapters.reduce((sum, c) => sum + (unlockMap.get(c.id)?.pulseCount ?? 0), 0);

            return {
                storyId: story.id,
                storyTitle: story.title,
                storySlug: story.slug,
                storyThumbnailUrl: story.thumbnailUrl,
                authorName: story.author?.name || '',
                createdAt: story.createdAt,
                totalViews: Number(story.totalViews || 0),
                vipChapterCount: vipChapters.length,
                timedChapterCount: timedChapters.length,
                totalChapterCount: chapters.length,
                vipOpenCount,
                timedOpenCount,
                totalOpenCount,
                totalCredits,
                vipCredits: 0,   // ไม่ใช้แล้ว — kept for interface compat
                timedCredits: 0, // ไม่ใช้แล้ว — kept for interface compat
                chapters,
            };
        });

        const sortFactor = sortOrder === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            const primary = sortBy === VipChapterSortBy.opens ? a.totalOpenCount - b.totalOpenCount : a.totalCredits - b.totalCredits;
            if (primary !== 0) return primary * sortFactor;

            const secondary = (a.storyTitle || '').localeCompare(b.storyTitle || '', 'vi');
            return secondary;
        });

        const total = rows.length;
        const start = (page - 1) * limit;
        const data = rows.slice(start, start + limit);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
            summary: {
                totalStories: total,
                totalVipChapters: rows.reduce((sum, row) => sum + row.vipChapterCount, 0),
                totalTimedChapters: rows.reduce((sum, row) => sum + row.timedChapterCount, 0),
                totalVipOpens: rows.reduce((sum, row) => sum + row.vipOpenCount, 0),
                totalTimedOpens: rows.reduce((sum, row) => sum + row.timedOpenCount, 0),
                totalCredits: rows.reduce((sum, row) => sum + row.totalCredits, 0),
            },
        };
    }

    async getTopStories(query: TopStoriesQueryDto) {
        const limit = Math.min(query.limit ?? 100, 100);
        const language = query.language?.trim();
        const langWhere = language ? { language: { key: language } } : {};

        const counterColumn: Partial<Record<TopStoryMetric, 'totalViews' | 'favoritesCount' | 'totalGifts'>> = {
            [TopStoryMetric.reads]: 'totalViews',
            [TopStoryMetric.favorites]: 'favoritesCount',
            [TopStoryMetric.gifts]: 'totalGifts',
        };

        const column = counterColumn[query.metric];
        if (column) {
            const stories = await this.prisma.story.findMany({
                where: { deletedAt: null, ...langWhere },
                orderBy: { [column]: 'desc' },
                take: limit,
                select: { id: true, title: true, slug: true, thumbnailUrl: true, [column]: true } as any,
            });
            return {
                data: stories.map((s: any, i: number) => ({
                    rank: i + 1,
                    storyId: s.id,
                    title: s.title,
                    slug: s.slug,
                    thumbnailUrl: s.thumbnailUrl ?? null,
                    value: Number(s[column] ?? 0),
                })),
            };
        }

        // Raw-SQL metrics (rating/comments/trending/revenue/audio) — implemented in Task 4.
        const ranked = await this.getTopStoriesAggregated(query.metric, limit, language);
        return { data: ranked };
    }

    // Placeholder replaced in Task 4.
    private async getTopStoriesAggregated(
        _metric: TopStoryMetric, _limit: number, _language?: string,
    ): Promise<Array<{ rank: number; storyId: string; title: string; slug: string; thumbnailUrl: string | null; value: number }>> {
        return [];
    }

}
