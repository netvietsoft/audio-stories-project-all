import HomePageClient, { type HomePageInitialData } from "../HomePageClient";

const initialData: HomePageInitialData = {
  newestStories: [],
  newestChapters: [],
  popularStories: [],
  completedStories: [],
  trendingStories: [],
  actionStories: [],
  xuyenKhongStories: [],
  shounenStories: [],
  tienHiepStories: [],
  topCategories: [],
  allCategories: [],
  authors: [],
  hallContributors: [],
  heroBanners: [],
  displayCategories: [],
  displayCategoryStories: {},
};

export default function StoryLandingPage() {
  return <HomePageClient initialData={initialData} />;
}
