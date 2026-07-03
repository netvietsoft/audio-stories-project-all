import Link from "@/components/shared/LocalizedLink";
import { Search, Home, Headphones } from "lucide-react";

export default function NotFound() {
  // Giả lập danh sách truyện phổ biến gợi ý cho user
  const popularStories = [
    { id: 1, title: "Phàm Nhân Tu Tiên", category: "Tiên Hiệp" },
    { id: 2, title: "Đấu Phá Thương Khung", category: "Huyền Huyễn" },
    { id: 3, title: "Vụng Trộm Không Thể Giấu", category: "Ngôn Tình" },
  ];

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      {/* Icon hoặc Hình ảnh 404 */}
      <div className="relative mb-8">
        <h1 className="text-9xl font-extrabold text-gray-200 dark:text-gray-800 tracking-widest">
          404
        </h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <Headphones className="h-20 w-20 text-pink-600 dark:text-pink-500 animate-bounce" />
        </div>
      </div>

      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Không tìm thấy trang!
      </h2>
      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
        Có vẻ như chương truyện bạn đang tìm kiếm đã bị di dời hoặc đường dẫn không chính xác. Đừng lo, vẫn còn rất nhiều truyện hay đang chờ bạn.
      </p>

      {/* Cụm Nút điều hướng */}
      <div className="flex flex-col sm:flex-row gap-4 mb-12">
        <Link 
          href="/" 
          className="flex items-center justify-center gap-2 px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-full font-medium transition-colors"
        >
          <Home className="h-5 w-5" /> Về trang chủ
        </Link>
        <Link 
          href="/search" 
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-white rounded-full font-medium transition-colors"
        >
          <Search className="h-5 w-5" /> Tìm kiếm truyện
        </Link>
      </div>

      {/* Gợi ý truyện */}
      <div className="w-full max-w-2xl text-left border-t border-gray-200 dark:border-gray-800 pt-8">
        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">
          Gợi ý cho bạn:
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {popularStories.map((story) => (
            <Link 
              key={story.id} 
              href={`/story/${story.id}`}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-pink-500 dark:hover:border-pink-500 transition-colors group"
            >
              <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 line-clamp-1">
                {story.title}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {story.category}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
