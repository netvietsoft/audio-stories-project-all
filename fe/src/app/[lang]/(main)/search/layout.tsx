import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Tìm kiếm truyện",
    description: "Tìm kiếm truyện audio theo tên, tác giả, thể loại trên Netviet Audio. Tìm ngay bộ truyện bạn yêu thích từ hàng nghìn đầu truyện chất lượng cao.",
    openGraph: {
        title: "Tìm kiếm | Netviet Audio",
        description: "Tìm kiếm truyện audio theo tên, thể loại, tác giả trên Netviet Audio.",
        type: "website",
    },
    robots: {
        index: false,
        follow: true,
    },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
