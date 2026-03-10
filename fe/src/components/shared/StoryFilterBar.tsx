"use client";

type CategoryOption = {
  id: number;
  name: string;
};

type AuthorOption = {
  id: string;
  name: string;
};

export type StoryFilterValue = {
  categoryId: string;
  authorId: string;
  status: "" | "completed" | "ongoing";
  sort: "latest" | "views" | "rating" | "title_asc" | "chapters_desc";
};

type StoryFilterBarProps = {
  categories: CategoryOption[];
  authors: AuthorOption[];
  value: StoryFilterValue;
  onChange: (next: StoryFilterValue) => void;
  onApply: () => void;
  isLoading?: boolean;
};

export default function StoryFilterBar({
  categories,
  authors,
  value,
  onChange,
  onApply,
  isLoading = false,
}: StoryFilterBarProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Bộ lọc truyện</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        <select
          value={value.categoryId}
          onChange={(e) => onChange({ ...value, categoryId: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">Tất cả thể loại</option>
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          value={value.authorId}
          onChange={(e) => onChange({ ...value, authorId: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">Tất cả tác giả</option>
          {authors.map((author) => (
            <option key={author.id} value={author.id}>
              {author.name}
            </option>
          ))}
        </select>

        <select
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value as StoryFilterValue["status"] })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="completed">Đã hoàn thành (Full)</option>
          <option value="ongoing">Còn tiếp</option>
        </select>

        <select
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value as StoryFilterValue["sort"] })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="latest">Mới cập nhật</option>
          <option value="views">Lượt xem nhiều nhất</option>
          <option value="rating">Đánh giá cao nhất</option>
          <option value="title_asc">Tên A-Z</option>
          <option value="chapters_desc">Số chương nhiều nhất</option>
        </select>

        <button
          type="button"
          onClick={onApply}
          disabled={isLoading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isLoading ? "Đang lọc..." : "Lọc truyện"}
        </button>
      </div>
    </div>
  );
}
