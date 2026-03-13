"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ChevronLeft, 
  Loader2, 
  Save, 
  Trash2,
  ChevronDown,
  Search,
  Check,
  Plus,
  Music,
  Image as ImageIcon,
  Facebook,
} from "lucide-react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";
import { revalidateStoriesCache } from "@/app/admin/_actions/revalidate";
import { UploadButton } from '@/lib/uploadthing';

const storySchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  slug: z.string().min(1, 'Slug không được để trống'),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  authorId: z.string().min(1, 'Vui lòng chọn tác giả'),
  status: z.enum(['ongoing', 'completed']),
  language: z.enum(['vi', 'en']),
  categoryIds: z.array(z.number()).min(1, 'Chọn ít nhất một thể loại'),
  audioUrl: z.string().optional(),
  facebookGroupUrl: z.string().url('URL không hợp lệ').optional().or(z.literal('')),
  isRecommended: z.boolean().optional(),
});

type StoryFormValues = z.infer<typeof storySchema>;

export default function EditStoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const storyId = params?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  
  const [isAuthorOpen, setIsAuthorOpen] = useState(false);
  const [authorSearch, setAuthorSearch] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  const authorRef = React.useRef<HTMLDivElement>(null);
  const categoryRef = React.useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StoryFormValues>({
    resolver: zodResolver(storySchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      thumbnailUrl: '',
      status: 'ongoing',
      language: 'vi',
      categoryIds: [],
      isRecommended: false,      facebookGroupUrl: '',    },
  });

  const title = watch('title');
  const selectedAuthorId = watch('authorId');
  const selectedCategoryIds = watch('categoryIds') || [];

  useEffect(() => {
    if (!storyId) return;

    const fetchData = async () => {
      try {
        const [storyRes, catsRes, authorsRes, chapsRes] = await Promise.all([
          apiClient.get(`/stories/admin/${storyId}`),
          apiClient.get('/stories/categories'),
          apiClient.get('/stories/authors'),
          apiClient.get(`/stories/${storyId}/chapters`),
        ]);

        const story = storyRes.data;
        
        setValue('title', story.title);
        setValue('slug', story.slug);
        setValue('description', story.description || '');
        setValue('thumbnailUrl', story.thumbnailUrl || '');
        setValue('status', story.status);
        setValue('language', story.language || 'vi');
        setValue('authorId', story.author?.id);
        setValue('categoryIds', (story.categories || []).map((item: any) => item.category.id));
        setValue('isRecommended', !!story.isRecommended);
        setValue('facebookGroupUrl', story.facebookGroupUrl || '');

        setCategories(catsRes.data);
        setAuthors(authorsRes.data);
        setChapters(chapsRes.data);
      } catch (error) {
        console.error("Failed to fetch story:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [storyId, setValue]);

  // Auto-generate slug
  useEffect(() => {
    if (title && !watch('slug')) {
      const generatedSlug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setValue('slug', generatedSlug);
    }
  }, [title, setValue, watch]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (authorRef.current && !authorRef.current.contains(event.target as Node)) {
        setIsAuthorOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onSubmit = async (data: StoryFormValues) => {
    if (!storyId) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/stories/${storyId}`, data);
      await revalidateStoriesCache();
      router.push("/admin/stories");
    } catch (error) {
      console.error("Failed to update story:", error);
      alert("Không thể cập nhật truyện. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategoryToggle = (id: number) => {
    if (selectedCategoryIds.includes(id)) {
      setValue('categoryIds', selectedCategoryIds.filter(c => c !== id));
    } else {
      setValue('categoryIds', [...selectedCategoryIds, id]);
    }
  };

  const filteredAuthors = authors.filter(a =>
    a.name.toLowerCase().includes(authorSearch.toLowerCase())
  );

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const selectedAuthor = authors.find(a => a.id === selectedAuthorId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className=" sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/stories"
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-black text-slate-900">Chỉnh sửa Truyện</h1>
                <p className="text-sm text-slate-500 mt-0.5">Cập nhật thông tin truyện</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/admin/stories")}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting || isUploadingThumbnail}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting || isUploadingThumbnail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isUploadingThumbnail ? 'Đang tải...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Thumbnail & Quick Info */}
          <div className="space-y-6">
            {/* Thumbnail */}
            <div className="bg-white rounded-[32px] border border-slate-200 p-6 space-y-4">
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Ảnh bìa</label>
              
              {watch('thumbnailUrl') ? (
                <div className="relative group w-24 h-36 overflow-hidden rounded-xl mx-auto">
                  <img src={watch('thumbnailUrl')} alt="Thumbnail" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setValue('thumbnailUrl', '')}
                    className="absolute top-1.5 right-1.5 p-1 bg-white/90 backdrop-blur-sm text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-lg"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <UploadButton
                  endpoint="imageUploader"
                  onUploadProgress={() => setIsUploadingThumbnail(true)}
                  onClientUploadComplete={async (res) => {
                    setIsUploadingThumbnail(false);
                    if (res && res[0]) {
                      setValue('thumbnailUrl', res[0].url);
                    }
                  }}
                  onUploadError={(error: Error) => {
                    setIsUploadingThumbnail(false);
                    alert(`Lỗi: ${error.message}`);
                  }}
                  appearance={{
                    container: { width: "100%" },
                    button() {
                      return {
                        width: "100%",
                        minHeight: "200px",
                        backgroundColor: "#f8fafc",
                        border: "2px dashed #e2e8f0",
                        borderRadius: "16px",
                        cursor: "pointer",
                        fontSize: "0px",
                      };
                    },
                    allowedContent: { display: "none" }
                  }}
                  content={{
                    button({ isUploading }) {
                      if (isUploading) return (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                          <span className="text-sm font-bold">Đang tải...</span>
                        </div>
                      );
                      return (
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-3 bg-white rounded-xl shadow-sm">
                            <ImageIcon className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-slate-700">Chọn ảnh bìa</p>
                            <p className="text-xs text-slate-400 mt-1">Tối đa 4MB</p>
                          </div>
                        </div>
                      );
                    }
                  }}
                />
              )}
              <input {...register('thumbnailUrl')} type="hidden" />
            </div>

            {/* Quick Settings */}
            <div className="bg-white rounded-[32px] border border-slate-200 p-6 space-y-6">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Cài đặt</h3>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Trạng thái</label>
                <div className="relative">
                  <select
                    {...register('status')}
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold appearance-none cursor-pointer"
                  >
                    <option value="ongoing">Đang ra</option>
                    <option value="completed">Hoàn thành</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Ngôn ngữ</label>
                <div className="relative">
                  <select
                    {...register('language')}
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold appearance-none cursor-pointer"
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Đề xuất</p>
                    <p className="text-xs text-slate-500 mt-0.5">Hiện trong slider</p>
                  </div>
                  <input 
                    type="checkbox" 
                    {...register('isRecommended')} 
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                  />
                </label>
              </div>
            </div>

            {/* Chapters */}
            <div className="bg-white rounded-[32px] border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Chương</h3>
                <Link
                  href={`/admin/stories/${storyId}/chapters`}
                  className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                </Link>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {chapters.length > 0 ? (
                  chapters.map((chap: any) => (
                    <div key={chap.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <Music className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">
                          Chương {chap.chapterNumber}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{chap.title}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">Chưa có chương</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-[32px] border border-slate-200 p-8 space-y-6">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Thông tin cơ bản</h3>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Tiêu đề truyện</label>
                <input
                  {...register('title')}
                  placeholder="Nhập tên truyện..."
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                />
                {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Slug (URL)</label>
                <input
                  {...register('slug')}
                  placeholder="ten-truyen-slug"
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                />
                {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase">Giới thiệu</label>
                <textarea
                  {...register('description')}
                  rows={6}
                  placeholder="Nhập giới thiệu về truyện..."
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                  <Facebook className="w-4 h-4 text-blue-600" />
                  Link cộng đồng Facebook
                </label>
                <input
                  {...register('facebookGroupUrl')}
                  type="url"
                  placeholder="https://www.facebook.com/groups/..."
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                />
                {errors.facebookGroupUrl && <p className="text-xs text-red-500">{errors.facebookGroupUrl.message}</p>}
              </div>
            </div>

            {/* Author & Categories */}
            <div className="bg-white rounded-[32px] border border-slate-200 p-8 space-y-6">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Tác giả & Thể loại</h3>
              
              {/* Author */}
              <div className="space-y-2" ref={authorRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 uppercase">Tác giả</label>
                  <Link href="/admin/authors" className="text-xs text-indigo-600 hover:text-indigo-700 font-bold">
                    + Thêm mới
                  </Link>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAuthorOpen(!isAuthorOpen)}
                    className="w-full bg-slate-50 text-left rounded-xl py-3 px-4 text-sm font-bold flex items-center justify-between"
                  >
                    <span className={selectedAuthor ? 'text-slate-900' : 'text-slate-400'}>
                      {selectedAuthor ? selectedAuthor.name : 'Chọn tác giả'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAuthorOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isAuthorOpen && (
                    <div className="absolute z-20 top-full left-0 w-full mt-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                      <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Tìm tác giả..."
                            className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-3 text-sm"
                            value={authorSearch}
                            onChange={(e) => setAuthorSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredAuthors.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setValue('authorId', a.id);
                              setIsAuthorOpen(false);
                              setAuthorSearch('');
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-slate-50 flex items-center justify-between"
                          >
                            {a.name}
                            {selectedAuthorId === a.id && <Check className="w-4 h-4 text-indigo-600" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {errors.authorId && <p className="text-xs text-red-500">{errors.authorId.message}</p>}
              </div>

              {/* Categories */}
              <div className="space-y-2" ref={categoryRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 uppercase">Thể loại</label>
                  <Link href="/admin/categories" className="text-xs text-indigo-600 hover:text-indigo-700 font-bold">
                    + Thêm mới
                  </Link>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                    className="w-full bg-slate-50 text-left rounded-xl py-3 px-4 text-sm font-bold flex items-center justify-between min-h-[48px]"
                  >
                    <div className="flex flex-wrap gap-2">
                      {selectedCategoryIds.length > 0 ? (
                        selectedCategoryIds.map(id => {
                          const cat = categories.find(c => c.id === id);
                          return cat ? (
                            <span key={id} className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-lg font-bold">
                              {cat.name}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-slate-400">Chọn thể loại</span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCategoryOpen && (
                    <div className="absolute z-20 top-full left-0 w-full mt-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                      <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Tìm thể loại..."
                            className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-3 text-sm"
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredCategories.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleCategoryToggle(cat.id)}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-slate-50 flex items-center justify-between"
                          >
                            {cat.name}
                            {selectedCategoryIds.includes(cat.id) && <Check className="w-4 h-4 text-indigo-600" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {errors.categoryIds && <p className="text-xs text-red-500">{errors.categoryIds.message}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
