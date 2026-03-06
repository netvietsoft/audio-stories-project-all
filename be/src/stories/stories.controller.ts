import { Controller, Get, Param, Query } from '@nestjs/common';

import { ExploreQueryDto } from './dto/explore-query.dto';
import { StoriesService } from './stories.service';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get('home')
  getHome() {
    return this.storiesService.getHomeStories();
  }

  @Get('categories')
  getCategories() {
    return this.storiesService.getAllCategories();
  }

  @Get('authors')
  getAuthors() {
    return this.storiesService.getAllAuthors();
  }

  @Get('explore')
  explore(@Query() query: ExploreQueryDto) {
    return this.storiesService.exploreStories(query);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.storiesService.getStoryDetail(slug);
  }
}
