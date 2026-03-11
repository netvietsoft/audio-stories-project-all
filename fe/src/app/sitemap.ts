import type { MetadataRoute } from "next";

<<<<<<< HEAD
// Static pages
const staticRoutes: { url: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }[] = [
    { url: "/", priority: 1.0, changeFrequency: "daily" },
    { url: "/trending", priority: 0.9, changeFrequency: "daily" },
    { url: "/new", priority: 0.9, changeFrequency: "daily" },
    { url: "/categories", priority: 0.8, changeFrequency: "weekly" },
    { url: "/vinh-danh", priority: 0.7, changeFrequency: "daily" },
    { url: "/about", priority: 0.5, changeFrequency: "monthly" },
    { url: "/terms", priority: 0.4, changeFrequency: "monthly" },
    { url: "/privacy", priority: 0.4, changeFrequency: "monthly" },
    { url: "/dmca", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

    const now = new Date();

    // Build static routes
    const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(({ url, priority, changeFrequency }) => ({
        url: `${siteUrl}${url}`,
        lastModified: now,
        changeFrequency,
        priority,
    }));

    // Fetch dynamic story slugs
    let storyEntries: MetadataRoute.Sitemap = [];
    let categoryEntries: MetadataRoute.Sitemap = [];

    try {
        const [storiesRes, categoriesRes] = await Promise.allSettled([
            fetch(`${apiUrl}/stories/explore?limit=500&sort=latest`, { next: { revalidate: 3600 } }),
            fetch(`${apiUrl}/stories/categories?limit=200`, { next: { revalidate: 86400 } }),
        ]);

        if (storiesRes.status === "fulfilled" && storiesRes.value.ok) {
            const data = await storiesRes.value.json();
            const stories: { slug: string; updatedAt?: string }[] = data?.data || [];
            storyEntries = stories.map((story) => ({
                url: `${siteUrl}/story/${story.slug}`,
                lastModified: story.updatedAt ? new Date(story.updatedAt) : now,
                changeFrequency: "weekly" as const,
                priority: 0.7,
            }));
        }

        if (categoriesRes.status === "fulfilled" && categoriesRes.value.ok) {
            const cats: { slug: string }[] = await categoriesRes.value.json();
            categoryEntries = (cats || []).map((cat) => ({
                url: `${siteUrl}/categories/${cat.slug}`,
                lastModified: now,
                changeFrequency: "weekly" as const,
                priority: 0.6,
            }));
        }
    } catch {
        // If dynamic fetch fails, just return static sitemap
    }

    return [...staticEntries, ...storyEntries, ...categoryEntries];
=======
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
>>>>>>> 8c465ef0528f9d81e28bbea6af67e61b03de2282
}
