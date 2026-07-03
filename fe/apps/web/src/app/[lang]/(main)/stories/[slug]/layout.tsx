import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;

    try {
        const res = await fetch(`${API_URL}/stories/categories`, {
            next: { revalidate: 86400 },
        });

        const categories: { slug: string; name: string; description?: string }[] = res.ok ? await res.json() : [];
        const cat = categories.find((c) => c.slug === slug);

        if (!cat) throw new Error("Not found");

        const title = `Truyện thể loại ${cat.name}`;
        const description = cat.description || `Nghe truyện audio thể loại ${cat.name} hay nhất, cập nhật mỗi ngày tại Netviet Audio.`;

        return {
            title,
            description,
            alternates: { canonical: `${SITE_URL}/categories/${slug}` },
            openGraph: {
                title: `${cat.name} | Netviet Audio`,
                description,
                type: "website",
            },
        };
    } catch {
        return {
            title: "Thể loại truyện | Netviet Audio",
            description: "Khám phá truyện audio theo thể loại tại Netviet Audio.",
        };
    }
}

export default function CategorySlugLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
