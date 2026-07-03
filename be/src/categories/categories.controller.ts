import {
    Controller,
    Get,
    Post,
    Query,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    ParseIntPipe,
    UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @ApiOperation({ summary: 'Lấy danh sách thể loại' })
    @Get()
    @UseInterceptors(CacheInterceptor)
    @CacheKey('categories:all')
    @CacheTTL(3600)
    findAll(@Query() query: CategoryQueryDto) {
        return this.categoriesService.findAll(query);
    }

    @ApiOperation({ summary: 'Lấy chi tiết thể loại theo id' })
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.categoriesService.findOne(id);
    }

    @ApiOperation({ summary: 'Tạo thể loại mới (admin)' })
    @Post()
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() createCategoryDto: CreateCategoryDto) {
        return this.categoriesService.create(createCategoryDto);
    }

    @ApiOperation({ summary: 'Cập nhật thể loại theo id (admin)' })
    @Patch(':id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateCategoryDto: UpdateCategoryDto,
    ) {
        return this.categoriesService.update(id, updateCategoryDto);
    }

    @ApiOperation({ summary: 'Xóa thể loại theo id (admin)' })
    @Delete(':id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.categoriesService.remove(id);
    }

    @ApiOperation({ summary: 'Xóa nhiều thể loại theo danh sách id (admin)' })
    @Delete('bulk/delete')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    bulkRemove(@Body('ids') ids: number[]) {
        return this.categoriesService.bulkRemove(ids);
    }
}
