import { Controller, Get, Query, Param, Patch, Body, Delete, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentQueryDto } from './dto/comment-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('comments')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN')
export class CommentsController {
    constructor(private readonly commentsService: CommentsService) { }

    @Get()
    findAll(@Query() query: CommentQueryDto) {
        return this.commentsService.findAll(query);
    }

    @Get('stats')
    getStats() {
        return this.commentsService.getStats();
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateCommentDto: UpdateCommentDto) {
        return this.commentsService.update(id, updateCommentDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.commentsService.remove(id);
    }
}
