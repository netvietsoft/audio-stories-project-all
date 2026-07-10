import {
  Controller, Get, Post, Query, Body, Patch, Param, Delete, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { LabelQueryDto } from './dto/label-query.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@ApiTags('Labels')
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @ApiOperation({ summary: 'Danh sách label' })
  @Get()
  findAll(@Query() query: LabelQueryDto) {
    return this.labelsService.findAll(query);
  }

  @ApiOperation({ summary: 'Chi tiết label' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.labelsService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo label (admin)' })
  @Post()
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateLabelDto) {
    return this.labelsService.create(dto);
  }

  @ApiOperation({ summary: 'Cập nhật label (admin)' })
  @Patch(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLabelDto) {
    return this.labelsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Xóa label (admin)' })
  @Delete(':id')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.labelsService.remove(id);
  }

  @ApiOperation({ summary: 'Xóa nhiều label (admin)' })
  @Delete('bulk/delete')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles('ADMIN')
  bulkRemove(@Body('ids') ids: number[]) {
    return this.labelsService.bulkRemove(ids);
  }
}
