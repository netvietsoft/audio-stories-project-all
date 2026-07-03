import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { CreateLanguageDto } from './dto/create-language.dto';
import { LanguageQueryDto } from './dto/language-query.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { LanguagesService } from './languages.service';

@ApiTags('Languages')
@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @ApiOperation({ summary: 'Lấy danh sách ngôn ngữ' })
  @Get()
  findAll(@Query() query: LanguageQueryDto) {
    return this.languagesService.findAll(query);
  }

  @ApiOperation({ summary: 'Lấy chi tiết ngôn ngữ theo id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.languagesService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo ngôn ngữ mới (admin)' })
  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createLanguageDto: CreateLanguageDto) {
    return this.languagesService.create(createLanguageDto);
  }

  @ApiOperation({ summary: 'Cập nhật ngôn ngữ theo id (admin)' })
  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLanguageDto: UpdateLanguageDto,
  ) {
    return this.languagesService.update(id, updateLanguageDto);
  }

  @ApiOperation({ summary: 'Xóa ngôn ngữ theo id (admin)' })
  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.languagesService.remove(id);
  }
}
