import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthorsService } from './authors.service';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@ApiTags('Authors')
@Controller('authors')
export class AuthorsController {
    constructor(private readonly authorsService: AuthorsService) { }

    @ApiOperation({ summary: 'Lấy danh sách tác giả' })
    @Get()
    findAll() {
        return this.authorsService.findAll();
    }

    @ApiOperation({ summary: 'Lấy chi tiết tác giả theo id' })
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.authorsService.findOne(id);
    }

    @ApiOperation({ summary: 'Tạo tác giả mới (admin)' })
    @Post()
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    create(@Body() createAuthorDto: CreateAuthorDto) {
        return this.authorsService.create(createAuthorDto);
    }

    @ApiOperation({ summary: 'Cập nhật tác giả theo id (admin)' })
    @Patch(':id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    update(@Param('id') id: string, @Body() updateAuthorDto: UpdateAuthorDto) {
        return this.authorsService.update(id, updateAuthorDto);
    }

    @ApiOperation({ summary: 'Xóa tác giả theo id (admin)' })
    @Delete(':id')
    @UseGuards(JwtAccessGuard, RolesGuard)
    @Roles('ADMIN')
    remove(@Param('id') id: string) {
        return this.authorsService.remove(id);
    }
}
