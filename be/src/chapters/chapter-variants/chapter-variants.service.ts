import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateChapterVariantDto } from '../dto/create-chapter-variant.dto';
import { UpdateChapterVariantDto } from '../dto/update-chapter-variant.dto';

@Injectable()
export class ChapterVariantsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAllByChapter(chapterId: string, parentId?: string | null) {
        const where: any = { chapterId, deletedAt: null };
        if (parentId !== undefined) {
            where.parentId = parentId;
        }
        return this.prisma.chapterVariant.findMany({
            where,
            orderBy: { orderIndex: 'asc' },
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
            select: { credits: true },
        });

        if (!user) throw new NotFoundException('User not found');
        if (user.credits < variant.unlockPrice) {
            throw new BadRequestException('Insufficient credits');
        }

        return this.prisma.$transaction(async (tx) => {
            // Deduct credits
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { credits: { decrement: variant.unlockPrice } },
            });

            // Create unlock record
            await tx.userUnlockedVariant.create({
                data: { userId, variantId },
            });

            // Create credit transaction record
            await tx.creditTransaction.create({
                data: {
                    userId,
                    amount: -variant.unlockPrice,
                    type: 'spend',
                    balanceBefore: user.credits,
                    balanceAfter: updatedUser.credits,
                    referenceId: variantId,
                    description: `Mở khóa biến thể: ${variant.title}`,
                },
            });

            return { success: true, balance: updatedUser.credits };
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
