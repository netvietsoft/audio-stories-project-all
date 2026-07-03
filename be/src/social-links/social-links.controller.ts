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
import { SocialLinksService } from './social-links.service';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Social Links')
@Controller('social-links')
export class SocialLinksController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @ApiOperation({ summary: 'Tạo liên kết mạng xã hội (admin)' })
  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() createDto: CreateSocialLinkDto) {
    return this.socialLinksService.create(createDto);
  }

  @ApiOperation({ summary: 'Lấy danh sách liên kết mạng xã hội công khai' })
  @Get()
  @Public()
  findAll() {
    return this.socialLinksService.findAll();
  }

  @ApiOperation({ summary: 'Lấy tất cả liên kết mạng xã hội (admin)' })
  @Get('admin/all')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin() {
    return this.socialLinksService.findAllAdmin();
  }

  @ApiOperation({ summary: 'Lấy chi tiết liên kết mạng xã hội theo id' })
  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.socialLinksService.findOne(id);
  }

  @ApiOperation({ summary: 'Cập nhật liên kết mạng xã hội theo id (admin)' })
  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() updateDto: UpdateSocialLinkDto) {
    return this.socialLinksService.update(id, updateDto);
  }

  @ApiOperation({ summary: 'Xóa liên kết mạng xã hội theo id (admin)' })
  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.socialLinksService.remove(id);
  }
}
