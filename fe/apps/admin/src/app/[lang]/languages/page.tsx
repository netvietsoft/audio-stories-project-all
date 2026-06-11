"use client";

import React, { useEffect, useState } from "react";
import { Globe2, Loader2, Plus, Save, Search, Trash2, X, Edit2 } from "lucide-react";

import { adminApiClient as apiClient } from "@/lib/api/admin-api-client";

interface LanguageItem {
  id: number;
  key: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface LanguageFormValues {
  key: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
}

const defaultFormData: LanguageFormValues = {
  key: "",
  name: "",
  isActive: true,
  displayOrder: 0,
};

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<LanguageItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formData, setFormData] = useState<LanguageFormValues>(defaultFormData);

  const limit = 12;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    fetchLanguages();
  }, [page, searchTerm]);

  const fetchLanguages = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/languages", {
        params: {
          page,
          limit,
          ...(searchTerm ? { search: searchTerm } : {}),
        },
      });

      setLanguages(Array.isArray(res.data?.data) ? res.data.data : []);
      setTotal(typeof res.data?.meta?.total === "number" ? res.data.meta.total : 0);
    } catch (error) {
      console.error("Failed to fetch languages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingLanguage(null);
    setFormData(defaultFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (language: LanguageItem) => {
    setEditingLanguage(language);
    setFormData({
      key: language.key,
      name: language.name,
      isActive: language.isActive,
      displayOrder: language.displayOrder,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLanguage(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.key.trim() || !formData.name.trim()) {
      alert("Vui lòng nhập key và tên ngôn ngữ.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingLanguage) {
        await apiClient.patch(`/languages/${editingLanguage.id}`, {
          key: formData.key,
          name: formData.name,
          isActive: formData.isActive,
          displayOrder: formData.displayOrder,
        });
      } else {
        await apiClient.post("/languages", {
          key: formData.key,
          name: formData.name,
          isActive: formData.isActive,
          displayOrder: formData.displayOrder,
        });
      }

      closeModal();
      fetchLanguages();
    } catch (error: any) {
      console.error("Failed to save language:", error);
      alert(error?.response?.data?.message || "Không thể lưu ngôn ngữ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (language: LanguageItem) => {
    if (!window.confirm(`Bạn có chắc muốn xóa ngôn ngữ "${language.key}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/languages/${language.id}`);
      fetchLanguages();
    } catch (error: any) {
      console.error("Failed to delete language:", error);
      alert(error?.response?.data?.message || "Không thể xóa ngôn ngữ.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-200">
              <Globe2 className="w-6 h-6 text-white" />
            </div>
            Quản lý Ngôn ngữ
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Cấu hình danh sách ngôn ngữ dùng cho bộ lọc ở trang quản trị.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 transition-all active:scale-95 shadow-lg shadow-cyan-200"
        >
          <Plus className="w-4 h-4" />
          Thêm ngôn ngữ
        </button>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo key hoặc tên ngôn ngữ..."
            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Key</th>
                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Tên hiển thị</th>
                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Thứ tự</th>
                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td colSpan={5} className="px-8 py-6">
                        <div className="h-10 bg-slate-50 rounded-2xl" />
                      </td>
                    </tr>
                  ))
              ) : languages.length > 0 ? (
                languages.map((language) => (
                  <tr key={language.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                    <td className="px-8 py-5">
                      <code className="text-xs font-black text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-lg px-2 py-1 uppercase">
                        {language.key}
                      </code>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-900">{language.name}</td>
                    <td className="px-8 py-5 text-center text-sm font-bold text-slate-700">{language.displayOrder}</td>
                    <td className="px-8 py-5 text-center">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          language.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {language.isActive ? "Hoạt động" : "Tắt"}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(language)}
                          className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(language)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <Globe2 className="w-6 h-6 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Chưa có ngôn ngữ</h3>
                    <p className="text-slate-500 mt-1">Bắt đầu bằng cách tạo ngôn ngữ đầu tiên.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-slate-500">
            Hiển thị <span className="text-slate-900">{languages.length}</span> /{" "}
            <span className="text-slate-900">{total}</span> ngôn ngữ
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              Trước
            </button>
            <span className="text-xs font-bold text-slate-500 px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              Tiếp
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">
                {editingLanguage ? "Chỉnh sửa ngôn ngữ" : "Thêm ngôn ngữ mới"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Language key</label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(event) => setFormData((prev) => ({ ...prev, key: event.target.value.toLowerCase() }))}
                  placeholder="vi, en, fr..."
                  required
                  className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 transition-all uppercase"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Tên hiển thị</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Tiếng Việt, English..."
                  required
                  className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Thứ tự</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        displayOrder: Number(event.target.value) || 0,
                      }))
                    }
                    min={0}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Trạng thái</label>
                  <div className="h-[48px] flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.isActive ? "bg-emerald-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.isActive ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-slate-600">
                      {formData.isActive ? "Hoạt động" : "Tắt"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 text-sm font-black text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-cyan-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-cyan-700 transition-all active:scale-95 shadow-lg shadow-cyan-100 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSubmitting ? "Đang lưu..." : editingLanguage ? "Cập nhật" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
