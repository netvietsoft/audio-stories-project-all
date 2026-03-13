import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Thể loại truyện audio",
    description: "Khám phá tất cả thể loại truyện audio trên Netviet Audio: tiên hiệp, kiếm hiệp, ngôn tình, trinh thám, cổ đại, dị giới và nhiều thể loại hấp dẫn khác.",
    keywords: ["thể loại truyện audio", "tiên hiệp", "kiếm hiệp", "ngôn tình", "trinh thám", "cổ đại"],
    openGraph: {
        title: "Thể loại | Netviet Audio",
        description: "Khám phá tất cả thể loại truyện audio: tiên hiệp, kiếm hiệp, ngôn tình, trinh thám, cổ đại...",
        type: "website",
    },
    alternates: {
        canonical: "/categories",
    },
};

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
