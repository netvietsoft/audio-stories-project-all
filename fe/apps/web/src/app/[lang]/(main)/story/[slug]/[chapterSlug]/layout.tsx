import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface Props {
    params: Promise<{ slug: string; chapterSlug: string }>;
}

function chapterNumberFromSlug(chapterSlug?: string) {
    if (!chapterSlug) return null;
    const match = chapterSlug.match(/chuong-(\d+)/);
    return match && match[1] ? parseInt(match[1], 10) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, chapterSlug } = await params;
    const chapterNumber = chapterNumberFromSlug(chapterSlug);

    try {
        const res = await fetch(`${API_URL}/stories/${slug}`, {
            next: { revalidate: 1800 },
        });

        if (!res.ok) throw new Error("Not found");

        const story = await res.json();

        const chapter = chapterNumber
            ? story.chapters?.find((c: { chapterNumber: number }) => c.chapterNumber === chapterNumber)
            : story.chapters?.[0];

        const storyTitle = story.title || "Truyện Audio";
        const { cleanChapterTitle } = await import("@/lib/formatChapterTitle");
        const cleanTitle = chapter ? cleanChapterTitle(chapter.title) : "";
        const chapterTitle = chapter
            ? `Chương ${chapter.chapterNumber}: ${cleanTitle}`
            : `Chương ${chapterNumber ?? 1}`;

        const title = `${chapterTitle} - ${storyTitle}`;
        const description = chapter?.description
            ? chapter.description.slice(0, 160)
            : `Nghe ${chapterTitle} của truyện ${storyTitle} tại Netviet Audio. Tác giả: ${story.author?.name || "Đang cập nhật"}.`;

        const image = chapter?.thumbnailUrl || story.thumbnailUrl || `${SITE_URL}/og-image.png`;
        const url = `${SITE_URL}/story/${slug}/${chapterSlug}`;

        const audioObjectJsonLd = {
            "@context": "https://schema.org",
            "@type": "AudioObject",
            name: title,
            description,
            url,
            image,
            inLanguage: "vi-VN",
            duration: chapter?.audioDuration ? `PT${Math.floor(chapter.audioDuration / 60)}M${chapter.audioDuration % 60}S` : undefined,
            author: story.author?.name
                ? { "@type": "Person", name: story.author.name }
                : undefined,
            partOfSeries: {
                "@type": "CreativeWorkSeries",
                name: storyTitle,
                url: `${SITE_URL}/story/${slug}`,
            },
        };

        return {
            title,
            description,
            alternates: { canonical: url },
            openGraph: {
                type: "article",
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
                "script:ld+json": JSON.stringify(audioObjectJsonLd),
            },
        };
    } catch {
        return {
            title: `Nghe truyện audio | Netviet Audio`,
            description: "Nghe truyện audio hay tại Netviet Audio.",
        };
    }
}

export default function ChapterLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
