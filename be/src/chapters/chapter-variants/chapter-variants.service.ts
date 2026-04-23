import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateChapterVariantDto } from '../dto/create-chapter-variant.dto';
import { UpdateChapterVariantDto } from '../dto/update-chapter-variant.dto';

type VariantViewerContext = {
    userId?: string;
    isAdmin?: boolean;
};

@Injectable()
export class ChapterVariantsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAllByChapter(
        chapterId: string,
        parentId?: string | null,
        viewer?: VariantViewerContext,
    ) {
        const where: any = { chapterId, deletedAt: null };
        if (parentId !== undefined) {
            where.parentId = parentId;
        }

        const variants: any[] = await this.prisma.chapterVariant.findMany({
            where,
            orderBy: { orderIndex: 'asc' },
        });

        if (viewer?.isAdmin) {
            return variants;
        }

        const paidVariantIds = variants
            .filter((variant) => (variant.unlockPrice ?? 0) > 0)
            .map((variant) => variant.id);

        let isVip = false;
        let unlockedVariantIds = new Set<string>();

        if (viewer?.userId) {
            const [user, unlocks] = await Promise.all([
                this.prisma.user.findUnique({
                    where: { id: viewer.userId },
                    select: { vipTier: true, vipExpirationDate: true },
                }),
                paidVariantIds.length > 0
                    ? this.prisma.userUnlockedVariant.findMany({
                        where: {
                            userId: viewer.userId,
                            variantId: { in: paidVariantIds },
                        },
                        select: { variantId: true },
                    })
                    : Promise.resolve([] as Array<{ variantId: string }>),
            ]);

            isVip =
                !!user &&
                (user.vipTier ?? 0) > 0 &&
                (!user.vipExpirationDate || user.vipExpirationDate > new Date());

            unlockedVariantIds = new Set(unlocks.map((row) => row.variantId));
        }

        return variants.map((variant: any) => {
            const hasAccess =
                (variant.unlockPrice ?? 0) <= 0 ||
                isVip ||
                unlockedVariantIds.has(variant.id);

            if (hasAccess) {
                return variant;
            }

            return {
                ...variant,
                content: null,
                audioUrl: null,
                r2AudioUrl: null,
            };
        });
    }

    async findOne(id: string) {
        const variant = await this.prisma.chapterVariant.findUnique({
            where: { id },
            include: { chapter: true },
        });

        if (!variant || variant.deletedAt) {
            throw new NotFoundException(`Variant with ID ${id} not found`);
        }

        return variant;
    }

    async create(data: CreateChapterVariantDto) {
        return this.prisma.chapterVariant.create({
            data,
        });
    }

    async update(id: string, data: UpdateChapterVariantDto) {
        await this.findOne(id);
        return this.prisma.chapterVariant.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.chapterVariant.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async unlockVariant(userId: string, variantId: string) {
        const variant = await this.findOne(variantId);
        
        // Check if already unlocked
        const existingUnlock = await this.prisma.userUnlockedVariant.findUnique({
            where: {
                userId_variantId: { userId, variantId },
            },
        });

        if (existingUnlock) {
            return { success: true, message: 'Variant already unlocked' };
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { pulseBalance: true },
        });

        if (!user) throw new NotFoundException('User not found');
        if (user.pulseBalance < variant.unlockPrice) {
            throw new BadRequestException('Insufficient Pulse');
        }

        return this.prisma.$transaction(async (tx) => {
            // Deduct pulse
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { pulseBalance: { decrement: variant.unlockPrice } },
            });

            // Create unlock record
            await tx.userUnlockedVariant.create({
                data: { userId, variantId },
            });

            // Create credit transaction record
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type: 'spend',
                        pulseAmount: -variant.unlockPrice,
                        pulseBalanceBefore: user.pulseBalance,
                        pulseBalanceAfter: updatedUser.pulseBalance,
                        referenceId: variantId,
                        description: `Mở khóa biến thể: ${variant.title}`,
                    },
                });

                return { success: true, balance: updatedUser.pulseBalance };
        });
    }

    async getUnlockedVariants(userId: string, chapterId: string) {
        const variants = await this.prisma.userUnlockedVariant.findMany({
            where: {
                userId,
                variant: {
                    chapterId,
                    deletedAt: null,
                },
            },
            select: { variantId: true },
        });
        return variants.map((v) => v.variantId);
    }
}
