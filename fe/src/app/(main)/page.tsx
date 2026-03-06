"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle, Flame, Clock } from "lucide-react";
import StoryCard from "@/components/shared/StoryCard";
import { apiClient } from "@/lib/api/apiClient"; // Kiểm tra lại đường dẫn import này cho khớp dự án của bạn

type HomeStory = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: "ongoing" | "completed";
  totalViews: number;
  author?: { name: string };
  categories?: { category: { name: string } }[];
};

type HomeResponse = {
  trending: HomeStory[];
  newest: HomeStory[];
  featured: HomeStory[];
};

export default function HomePage() {
  const [data, setData] = useState<HomeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHome = async () => {
      try {
        const response: any = await apiClient.get("/stories/home");
        setData(response.data || response); // Xử lý tùy theo cấu trúc NestJS trả về
      } catch (error) {
        console.error("Lỗi khi tải trang chủ:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHome();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      
      {/* 1. HERO SECTION (UI cũ) */}
      <section className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-xl">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="px-6 py-16 md:px-12 md:py-20 relative z-10 flex flex-col items-start">
          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wider mb-4 border border-white/30 backdrop-blur-sm">
            NỀN TẢNG AUDIO SỐ 1
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 leading-tight">
            Thế Giới Truyện <br className="hidden md:block" /> Trong Tầm Tai Bạn
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl text-blue-100 font-light">
            Hàng ngàn bộ truyện Tiên Hiệp, Kiếm Hiệp, Ngôn Tình được thu âm với chất lượng cao nhất, hoàn toàn miễn phí.
          </p>
          <div className="flex gap-4">
            <Link href="/trending" className="inline-flex items-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-full font-bold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              <PlayCircle className="w-5 h-5" /> Nghe Ngay
            </Link>
            <Link href="/explore" className="inline-flex items-center gap-2 bg-blue-800/50 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-800 transition-all border border-blue-600 backdrop-blur-sm">
              Khám Phá
            </Link>
          </div>
        </div>
      </section>

      {/* 2. THỊNH HÀNH */}
      {data?.trending && data.trending.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Flame className="text-red-500 w-6 h-6" /> Thịnh Hành Tuần Này
            </h2>
            <Link href="/trending" className="text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 text-sm font-semibold hover:underline">
              Xem tất cả
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {data.trending.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      {/* 3. MỚI CẬP NHẬT */}
      {data?.newest && data.newest.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <Clock className="text-blue-500 w-6 h-6" /> Chương Mới Nhất
            </h2>
            <Link href="/new" className="text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 text-sm font-semibold hover:underline">
              Xem tất cả
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {data.newest.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}