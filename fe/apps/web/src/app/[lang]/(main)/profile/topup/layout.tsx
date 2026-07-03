import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Nạp Pulse",
    description: "Nạp pulse để mở khóa nội dung VIP và thưởng thức toàn bộ truyện audio trên Netviet Audio. Nhiều gói pulse phù hợp với mọi nhu cầu.",
    openGraph: {
        title: "Nạp Pulse | Netviet Audio",
        description: "Nạp pulse để trải nghiệm truyện audio VIP chất lượng cao trên Netviet Audio.",
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
