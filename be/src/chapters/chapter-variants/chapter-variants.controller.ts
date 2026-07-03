import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChapterVariantsService } from './chapter-variants.service';
import { CreateChapterVariantDto } from '../dto/create-chapter-variant.dto';
import { UpdateChapterVariantDto } from '../dto/update-chapter-variant.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { OptionalJwtGuard } from '@/auth/guards/optional-jwt.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Account } from '@/auth/decorators/account.decorator';

@ApiTags('Chapter Variants')
@Controller()
export class ChapterVariantsController {
    constructor(private readonly chapterVariantsService: ChapterVariantsService) { }

    @ApiOperation({ summary: 'Lấy danh sách biến thể theo chương' })
    @Get('chapters/:chapterId/variants')
    @UseGuards(OptionalJwtGuard)
    findAllByChapter(
        @Param('chapterId') chapterId: string,
        @Query('parentId') parentId?: string,
        @Req() req?: Request,
    ) {
        const user = req?.user as any;
        const userId = user?.id || user?.sub;
        const roles = Array.isArray(user?.roles) ? user.roles : [];
        const isAdmin = roles.some((role: any) => String(role || '').toUpperCase() === 'ADMIN');

        return this.chapterVariantsService.findAllByChapter(
            chapterId,
            parentId === 'null' ? null : (parentId || undefined),
            { userId, isAdmin },
        );
    }

    @ApiOperation({ summary: 'Lấy chi tiết biến thể theo id (admin)' })
    @Get('chapter-variants/:id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    findOne(@Param('id') id: string) {
        return this.chapterVariantsService.findOne(id);
    }

    @ApiOperation({ summary: 'Tạo biến thể chương (admin)' })
    @Post('chapter-variants')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() createDto: CreateChapterVariantDto) {
        return this.chapterVariantsService.create(createDto);
    }

    @ApiOperation({ summary: 'Cập nhật biến thể chương theo id (admin)' })
    @Patch('chapter-variants/:id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    update(@Param('id') id: string, @Body() updateDto: UpdateChapterVariantDto) {
        return this.chapterVariantsService.update(id, updateDto);
    }

    @ApiOperation({ summary: 'Xóa biến thể chương theo id (admin)' })
    @Delete('chapter-variants/:id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('id') id: string) {
        return this.chapterVariantsService.remove(id);
    }

    @ApiOperation({ summary: 'Mở khóa biến thể chương' })
    @Post('chapter-variants/:id/unlock')
    @UseGuards(JwtAccessGuard)
    unlock(@Param('id') id: string, @Account() user: any) {
        return this.chapterVariantsService.unlockVariant(user.id, id);
    }

    @ApiOperation({ summary: 'Lấy danh sách biến thể đã mở khóa theo chương' })
    @Get('chapters/:chapterId/unlocked-variants')
    @UseGuards(JwtAccessGuard)
    getUnlocked(@Param('chapterId') chapterId: string, @Account() user: any) {
        return this.chapterVariantsService.getUnlockedVariants(user.id, chapterId);
    }
}
