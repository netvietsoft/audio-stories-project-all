import type { Metadata } from "next";
import { unwrapData } from "@/lib/api/unwrap";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;

    try {
        const res = await fetch(`${API_URL}/stories/${slug}`, {
            next: { revalidate: 3600 },
        });

        if (!res.ok) throw new Error("Not found");

        const story = unwrapData<any>(await res.json());
        if (!story) throw new Error("Not found");

        const title = story.title || "Truyện Audio";
        const description = story.description
            ? story.description.slice(0, 160)
            : `Nghe truyện audio ${title} chất lượng cao tại Netviet Audio. ${story.chapters?.length || 0} chương.`;
        const image = story.thumbnailUrl || `${SITE_URL}/og-image.png`;
        const url = `${SITE_URL}/story/${slug}`;

        const storyJsonLd = {
            "@context": "https://schema.org",
            "@type": "Book",
            name: title,
            description: story.description || description,
            url,
            image,
            author: story.author?.name
                ? { "@type": "Person", name: story.author.name }
                : undefined,
            inLanguage: "vi-VN",
            numberOfPages: story.chapters?.length,
            bookFormat: "AudioBook",
        };

        return {
            title,
            description,
            alternates: { canonical: url },
            openGraph: {
                type: "book",
                url,
                title,
                description,
                images: [{ url: image, width: 600, height: 900, alt: title }],
                locale: "vi_VN",
                siteName: "Netviet Audio",
            },
            twitter: {
                card: "summary",
                title,
                description,
                images: [image],
            },
            other: {
                "script:ld+json": JSON.stringify(storyJsonLd),
            },
        };
    } catch {
        return {
            title: "Truyện Audio | Netviet Audio",
            description: "Nghe truyện audio hay tại Netviet Audio.",
        };
    }
}

export default function StoryLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
