import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Bảng xếp hạng hội viên VIP",
    description: "Xem bảng xếp hạng những hội viên VIP đóng góp nhiều nhất và ủng hộ Netviet Audio. Vinh danh những thành viên tích cực nhất cộng đồng.",
    openGraph: {
        title: "Vinh danh hội viên | Netviet Audio",
        description: "Bảng xếp hạng hội viên VIP đóng góp nhiều nhất tại Netviet Audio.",
        type: "website",
    },
    alternates: {
        canonical: "/vinh-danh",
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default function VinhDanhLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
