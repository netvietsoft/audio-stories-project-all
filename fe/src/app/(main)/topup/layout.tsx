import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Nạp Credits",
    description: "Nạp credits để mở khóa nội dung VIP và thưởng thức toàn bộ truyện audio trên Netviet Audio. Nhiều gói credits phù hợp với mọi nhu cầu.",
    openGraph: {
        title: "Nạp Credits | Netviet Audio",
        description: "Nạp credits để trải nghiệm truyện audio VIP chất lượng cao trên Netviet Audio.",
        type: "website",
    },
    robots: {
        index: false,
        follow: false,
    },
};

export default function TopupLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
