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
import { SocialLinksService } from './social-links.service';
import { CreateSocialLinkDto } from './dto/create-social-link.dto';
import { UpdateSocialLinkDto } from './dto/update-social-link.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('social-links')
export class SocialLinksController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('admin')
  create(@Body() createDto: CreateSocialLinkDto) {
    return this.socialLinksService.create(createDto);
  }

  @Get()
  @Public()
  findAll() {
    return this.socialLinksService.findAll();
  }

  @Get('admin/all')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('admin')
  findAllAdmin() {
    return this.socialLinksService.findAllAdmin();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.socialLinksService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() updateDto: UpdateSocialLinkDto) {
    return this.socialLinksService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.socialLinksService.remove(id);
  }
}
