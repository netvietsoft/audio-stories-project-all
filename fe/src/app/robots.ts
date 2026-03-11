import type { MetadataRoute } from "next";

<<<<<<< HEAD
export default function robots(): MetadataRoute.Robots {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/admin",
                    "/admin/",
                    "/api/",
                    "/profile/",
                    "/notifications",
                    "/topup",
                ],
            },
            {
                // Block AI training crawlers
                userAgent: ["GPTBot", "CCBot", "anthropic-ai", "Claude-Web", "Google-Extended"],
                disallow: "/",
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
        host: siteUrl,
    };
=======
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://webtruyen.vn";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Không cho crawl các trang admin và API
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
>>>>>>> 8c465ef0528f9d81e28bbea6af67e61b03de2282
}
