import type { MetadataRoute } from "next";
import { unwrapList } from "@/lib/api/unwrap";

// Static pages
const staticRoutes: { url: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }[] = [
  { url: "/", priority: 1.0, changeFrequency: "daily" },
  { url: "/story", priority: 0.95, changeFrequency: "daily" },
  { url: "/music", priority: 0.95, changeFrequency: "daily" },
  { url: "/story/trending", priority: 0.9, changeFrequency: "daily" },
  { url: "/story/new", priority: 0.9, changeFrequency: "daily" },
  { url: "/story/stories", priority: 0.8, changeFrequency: "weekly" },
  { url: "/story/vinh-danh", priority: 0.7, changeFrequency: "daily" },
  { url: "/about", priority: 0.5, changeFrequency: "monthly" },
  { url: "/terms", priority: 0.4, changeFrequency: "monthly" },
  { url: "/privacy", priority: 0.4, changeFrequency: "monthly" },
  { url: "/dmca", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

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
      const stories = unwrapList<{ slug: string; updatedAt?: string }>(data);
      storyEntries = stories.map((story) => ({
        url: `${siteUrl}/story/${story.slug}`,
        lastModified: story.updatedAt ? new Date(story.updatedAt) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }

    if (categoriesRes.status === "fulfilled" && categoriesRes.value.ok) {
      const catsData = await categoriesRes.value.json();
      const cats = unwrapList<{ slug: string }>(catsData);
      categoryEntries = cats.map((cat) => ({
        url: `${siteUrl}/story/categories/${cat.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch {
    // If dynamic fetch fails, just return static sitemap
  }

  return [...staticEntries, ...storyEntries, ...categoryEntries];
}
