import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Truyện mới cập nhật",
    description: "Danh sách truyện audio mới được cập nhật chương mới nhất hôm nay trên Netviet Audio. Không bỏ lỡ bất kỳ chương mới nào từ những bộ truyện hay nhất.",
    openGraph: {
        title: "Truyện mới cập nhật | Netviet Audio",
        description: "Danh sách truyện audio mới cập nhật hôm nay. Không bỏ lỡ chương mới từ những bộ truyện hay nhất.",
        type: "website",
    },
    alternates: {
        canonical: "/new",
    },
};

export default function NewLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
