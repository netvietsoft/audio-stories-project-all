import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CommentQueryDto } from './dto/comment-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CommentsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(query: CommentQueryDto) {
        const { page = 1, limit = 20, search, isHidden, storyId, chapterId } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.ChapterCommentWhereInput = {
            ...(typeof isHidden === 'boolean' ? { isHidden } : {}),
            ...(storyId ? { storyId } : {}),
            ...(chapterId ? { chapterId } : {}),
            ...(search
                ? {
                    OR: [
                        { content: { contains: search } },
                        { user: { email: { contains: search } } },
                        { user: { displayName: { contains: search } } },
                    ],
                }
                : {}),
        };

        const [comments, total] = await Promise.all([
            this.prisma.chapterComment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            displayName: true,
                            avatarUrl: true,
                        },
                    },
                    chapter: {
                        select: {
                            id: true,
                            title: true,
                            chapterNumber: true,
                        },
                    },
                    story: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                    parent: {
                        select: {
                            id: true,
                            content: true,
                            user: {
                                select: {
                                    displayName: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            replies: true,
                        },
                    },
                },
            }),
            this.prisma.chapterComment.count({ where }),
        ]);

        return {
            data: comments,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getStats() {
        const [totalComments, hiddenComments, todayComments] = await Promise.all([
            this.prisma.chapterComment.count(),
            this.prisma.chapterComment.count({ where: { isHidden: true } }),
            this.prisma.chapterComment.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
            }),
        ]);

        return {
            totalComments,
            hiddenComments,
            visibleComments: totalComments - hiddenComments,
            todayComments,
        };
    }

    async update(id: string, updateCommentDto: UpdateCommentDto) {
        const comment = await this.prisma.chapterComment.findUnique({
            where: { id },
        });

        if (!comment) {
            throw new NotFoundException(`Comment with ID ${id} not found`);
        }

        return this.prisma.chapterComment.update({
            where: { id },
            data: updateCommentDto,
        });
    }

    async remove(id: string) {
        const comment = await this.prisma.chapterComment.findUnique({
            where: { id },
        });

        if (!comment) {
            throw new NotFoundException(`Comment with ID ${id} not found`);
        }

        return this.prisma.chapterComment.delete({
            where: { id },
        });
    }
}
