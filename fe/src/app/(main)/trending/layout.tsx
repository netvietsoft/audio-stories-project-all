import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Truyện đang thịnh hành",
    description: "Top truyện audio đang được nghe nhiều nhất tuần này trên Netviet Audio. Khám phá những bộ truyện hot nhất cộng đồng đang yêu thích.",
    openGraph: {
        title: "Trending | Netviet Audio",
        description: "Top truyện audio được nghe nhiều nhất tuần này. Khám phá những bộ truyện hot nhất.",
        type: "website",
    },
    alternates: {
        canonical: "/trending",
    },
};

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
