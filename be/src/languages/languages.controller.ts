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

import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { CreateLanguageDto } from './dto/create-language.dto';
import { LanguageQueryDto } from './dto/language-query.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { LanguagesService } from './languages.service';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  findAll(@Query() query: LanguageQueryDto) {
    return this.languagesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.languagesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createLanguageDto: CreateLanguageDto) {
    return this.languagesService.create(createLanguageDto);
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLanguageDto: UpdateLanguageDto,
  ) {
    return this.languagesService.update(id, updateLanguageDto);
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.languagesService.remove(id);
  }
}
