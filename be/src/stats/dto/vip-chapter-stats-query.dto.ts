import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsPositive, IsString, IsInt } from 'class-validator';

export enum VipChapterAccessFilter {
  all = 'all',
  vip = 'vip',
  timed = 'timed',
}

export enum VipChapterSortBy {
  credits = 'credits',
  opens = 'opens',
}

export enum VipChapterSortOrder {
  asc = 'asc',
  desc = 'desc',
}

export class VipChapterStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(VipChapterAccessFilter)
  accessType?: VipChapterAccessFilter = VipChapterAccessFilter.all;

  @IsOptional()
  @IsEnum(VipChapterSortBy)
  sortBy?: VipChapterSortBy = VipChapterSortBy.credits;

  @IsOptional()
  @IsEnum(VipChapterSortOrder)
  sortOrder?: VipChapterSortOrder = VipChapterSortOrder.desc;
}