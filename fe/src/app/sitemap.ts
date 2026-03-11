import type { MetadataRoute } from "next";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://webtruyen.vn";

type StoryEntry = {
  slug: string;
  updatedAt: string;
};

type StoriesApiResponse = {
  data: StoryEntry[];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/trending`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/new`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/vinh-danh`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  try {
    // Lấy danh sách tất cả truyện (public endpoint, không cần auth)
    const res = await fetch(`${API_BASE_URL}/stories/explore?limit=500&page=1`, {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const json: StoriesApiResponse = await res.json();
      const stories: StoryEntry[] = json?.data ?? [];

      const storyPages: MetadataRoute.Sitemap = stories.map((story) => {
        const lastMod = story.updatedAt ? new Date(story.updatedAt) : new Date();
        return {
          url: `${SITE_URL}/story/${story.slug}`,
          lastModified: Number.isNaN(lastMod.getTime()) ? new Date() : lastMod,
          changeFrequency: "weekly",
          priority: 0.7,
        };
      });

      return [...staticPages, ...storyPages];
    }
  } catch {
    // Nếu không fetch được stories thì chỉ trả về trang tĩnh
  }

  return staticPages;
}
