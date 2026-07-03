import type { Metadata } from "next";

import { unwrapList } from "../../../lib/api/unwrap";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
    title: "Trang chủ",
    description:
        "Khám phá hàng nghìn truyện audio hay nhất Việt Nam trên Netviet Audio. Cập nhật mỗi ngày với truyện tiên hiệp, kiếm hiệp, ngôn tình, trinh thám, cổ đại và nhiều thể loại hấp dẫn khác.",
    alternates: { canonical: SITE_URL },
    openGraph: {
        type: "website",
        url: SITE_URL,
        title: "Netviet Audio - Nghe Truyện Audio Hay Nhất",
        description:
            "Khám phá hàng nghìn truyện audio hay nhất Việt Nam. Cập nhật mỗi ngày với truyện tiên hiệp, kiếm hiệp, ngôn tình, trinh thám, cổ đại...",
        images: [
            {
                url: `${SITE_URL}/og-image.png`,
                width: 1200,
                height: 630,
                alt: "Netviet Audio - Nền tảng nghe truyện audio hàng đầu",
            },
        ],
        locale: "vi_VN",
        siteName: "Netviet Audio",
    },
};

// Fetch categories for BreadcrumbList JSON-LD
async function getTopCategories() {
    try {
            const res = await fetch(`${API_URL}/stories/categories/top?limit=6`, {
                next: { revalidate: 0 },
            });
        if (!res.ok) return [];
        const data = await res.json();
        return unwrapList<{ name: string; slug: string }>(data);
    } catch {
        return [];
    }
}

export default async function HomePageWrapper() {
    const categories = await getTopCategories();

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Truyện mới", item: `${SITE_URL}/new` },
            { "@type": "ListItem", position: 3, name: "Trending", item: `${SITE_URL}/trending` },
            ...categories.map((cat: { name: string; slug: string }, idx: number) => ({
                "@type": "ListItem",
                position: idx + 4,
                name: cat.name,
                item: `${SITE_URL}/categories/${cat.slug}`,
            })),
        ],
    };

    const { default: HomePage } = await import("./page");

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <HomePage />
        </>
    );
}
