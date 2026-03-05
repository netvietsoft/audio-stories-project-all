"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayCircle, Flame, Clock, Heart } from "lucide-react";

export default function HomePage() {
  const mockStories = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  // State lưu trữ danh sách ID các truyện đã được thả tim
  const [favorites, setFavorites] = useState<number[]>([]);

  // Hàm xử lý khi click vào trái tim
  const toggleFavorite = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // Ngăn chặn thẻ Link chuyển trang
    
    setFavorites((prev) => {
      if (prev.includes(id)) {
        // Nếu đã có trong danh sách -> Bỏ tim (Xóa khỏi mảng)
        return prev.filter((favId) => favId !== id);
      } else {
        // Nếu chưa có -> Thả tim (Thêm vào mảng)
        return [...prev, id];
      }
    });
  };

  return (
    <div className="space-y-12">
      
      {/* 1. HERO SECTION (Giữ nguyên) */}
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
            <Link href="/categories" className="inline-flex items-center gap-2 bg-blue-800/50 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-800 transition-all border border-blue-600 backdrop-blur-sm">
              Khám Phá
            </Link>
          </div>
        </div>
      </section>

      {/* 2. TRUYỆN THỊNH HÀNH (Trending) */}
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
          {mockStories.slice(0, 5).map((item) => {
            const isFav = favorites.includes(item); // Kiểm tra xem truyện này đã được thả tim chưa

            return (
              <Link href={`/story/${item}`} key={item} className="group flex flex-col relative rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-800 relative w-full h-full">
                  <img src={`https://picsum.photos/seed/${item}/300/450`} alt="Cover" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  
                  {/* NÚT YÊU THÍCH ĐÃ CÓ STATE */}
                  <button 
                    onClick={(e) => toggleFavorite(e, item)}
                    className={`absolute top-2 right-2 p-2 backdrop-blur-sm rounded-full transition-all z-20 shadow-sm
                      ${isFav ? "bg-white/90 text-red-500 hover:bg-white" : "bg-black/40 text-white hover:bg-red-500"}
                    `}
                  >
                    {/* fill="currentColor" giúp tô kín trái tim nếu isFav = true */}
                    <Heart className="w-4 h-4" fill={isFav ? "currentColor" : "none"} />
                  </button>

                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md z-20">
                    FULL
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3 z-10">
                    <h3 className="font-bold text-sm md:text-base text-white line-clamp-1 group-hover:text-blue-400 transition-colors shadow-black drop-shadow-md">
                      Phàm Nhân Tu Tiên Phần {item}
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 drop-shadow-md flex items-center justify-between">
                      <span>Tiên Hiệp</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/20 rounded">1.2M Nghe</span>
                    </p>
                  </div>

                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-[15]">
                    <PlayCircle className="text-white w-14 h-14 drop-shadow-xl" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. MỚI CẬP NHẬT */}
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
          {mockStories.slice(5, 10).map((item) => {
            const isFav = favorites.includes(item); // ID truyện mới cập nhật

            return (
              <Link href={`/story/${item}`} key={item} className="group flex flex-col relative rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-800 relative w-full h-full">
                  <img src={`https://picsum.photos/seed/${item+10}/300/450`} alt="Cover" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  
                  {/* NÚT YÊU THÍCH CHO PHẦN MỚI CẬP NHẬT */}
                  <button 
                    onClick={(e) => toggleFavorite(e, item)}
                    className={`absolute top-2 right-2 p-2 backdrop-blur-sm rounded-full transition-all z-20 shadow-sm
                      ${isFav ? "bg-white/90 text-red-500 hover:bg-white" : "bg-black/40 text-white hover:bg-red-500"}
                    `}
                  >
                    <Heart className="w-4 h-4" fill={isFav ? "currentColor" : "none"} />
                  </button>

                  <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3 z-10">
                    <h3 className="font-bold text-sm md:text-base text-white line-clamp-1 group-hover:text-blue-400 transition-colors shadow-black drop-shadow-md">
                      Đấu Phá Thương Khung {item}
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 drop-shadow-md flex items-center justify-between">
                      <span>Huyền Huyễn</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white font-medium rounded">Chương {item * 12}</span>
                    </p>
                  </div>

                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-[15]">
                    <PlayCircle className="text-white w-14 h-14 drop-shadow-xl" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

    </div>
  );
}