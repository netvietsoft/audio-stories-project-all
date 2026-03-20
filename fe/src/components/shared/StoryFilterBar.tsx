"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Check, Search } from "lucide-react";
import { getLocalizedValue } from "@/lib/story-localization";

type CategoryOption = {
  id: number;
  name: string;
  nameVi?: string | null;
  nameEn?: string | null;
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
  const t = useTranslations("StoryFilterBar");
  const locale = useLocale();
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isAuthorOpen, setIsAuthorOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const [categorySearch, setCategorySearch] = useState("");
  const [authorSearch, setAuthorSearch] = useState("");

  const categoryRef = useRef<HTMLDivElement>(null);
  const authorRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (authorRef.current && !authorRef.current.contains(event.target as Node)) {
        setIsAuthorOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCategory = categories.find((c) => String(c.id) === value.categoryId);
  const selectedAuthor = authors.find((a) => a.id === value.authorId);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filteredAuthors = authors.filter((a) =>
    a.name.toLowerCase().includes(authorSearch.toLowerCase())
  );

  const statusOptions = [
    { value: "", label: t("allStatuses") },
    { value: "completed", label: t("completed") },
    { value: "ongoing", label: t("ongoing") },
  ];

  const sortOptions = [
    { value: "latest", label: t("sortLatest") },
    { value: "views", label: t("sortViews") },
    { value: "rating", label: t("sortRating") },
    { value: "title_asc", label: t("sortTitle") },
    { value: "chapters_desc", label: t("sortChapters") },
  ];

  const selectedStatus = statusOptions.find((s) => s.value === value.status);
  const selectedSort = sortOptions.find((s) => s.value === value.sort);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
        {t("quickFilter")}
      </h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {/* Category Dropdown */}
        <div className="relative" ref={categoryRef}>
          <button
            type="button"
            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-left rounded-xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/20 transition-all flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className={selectedCategory ? "text-slate-900 dark:text-white" : "text-slate-400"}>
              {selectedCategory 
                ? getLocalizedValue(locale, selectedCategory.nameVi, selectedCategory.nameEn, selectedCategory.name) 
                : t("allCategories")}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${isCategoryOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isCategoryOpen && (
            <div className="absolute z-50 top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder={t("searchCategories")}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 pl-10 pr-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...value, categoryId: "" });
                    setIsCategoryOpen(false);
                    setCategorySearch("");
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors flex items-center justify-between"
                >
                  {t("allCategories")}
                  {!value.categoryId && <Check className="w-4 h-4 text-blue-600" />}
                </button>
                {filteredCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange({ ...value, categoryId: String(c.id) });
                      setIsCategoryOpen(false);
                      setCategorySearch("");
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors flex items-center justify-between"
                  >
                    {getLocalizedValue(locale, c.nameVi, c.nameEn, c.name)}
                    {String(c.id) === value.categoryId && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Author Dropdown */}
        <div className="relative" ref={authorRef}>
          <button
            type="button"
            onClick={() => setIsAuthorOpen(!isAuthorOpen)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-left rounded-xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/20 transition-all flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className={selectedAuthor ? "text-slate-900 dark:text-white" : "text-slate-400"}>
              {selectedAuthor ? selectedAuthor.name : t("allAuthors")}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${isAuthorOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isAuthorOpen && (
            <div className="absolute z-50 top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder={t("searchAuthors")}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-2 pl-10 pr-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20"
                    value={authorSearch}
                    onChange={(e) => setAuthorSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...value, authorId: "" });
                    setIsAuthorOpen(false);
                    setAuthorSearch("");
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors flex items-center justify-between"
                >
                  {t("allAuthors")}
                  {!value.authorId && <Check className="w-4 h-4 text-blue-600" />}
                </button>
                {filteredAuthors.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onChange({ ...value, authorId: a.id });
                      setIsAuthorOpen(false);
                      setAuthorSearch("");
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors flex items-center justify-between"
                  >
                    {a.name}
                    {a.id === value.authorId && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="relative" ref={statusRef}>
          <button
            type="button"
            onClick={() => setIsStatusOpen(!isStatusOpen)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-left rounded-xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/20 transition-all flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className={selectedStatus?.value ? "text-slate-900 dark:text-white" : "text-slate-400"}>
              {selectedStatus?.label || t("allStatuses")}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${isStatusOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isStatusOpen && (
            <div className="absolute z-50 top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {statusOptions.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    onChange({ ...value, status: s.value as StoryFilterValue["status"] });
                    setIsStatusOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors flex items-center justify-between"
                >
                  {s.label}
                  {s.value === value.status && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            type="button"
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-left rounded-xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/20 transition-all flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className="text-slate-900 dark:text-white">{selectedSort?.label}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${isSortOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isSortOpen && (
            <div className="absolute z-50 top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {sortOptions.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    onChange({ ...value, sort: s.value as StoryFilterValue["sort"] });
                    setIsSortOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors flex items-center justify-between"
                >
                  {s.label}
                  {s.value === value.sort && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Apply Button */}
        <button
          type="button"
          onClick={onApply}
          disabled={isLoading}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition-all shadow-sm hover:shadow-md"
        >
          {isLoading ? t("applying") : t("apply")}
        </button>
      </div>
    </div>
  );
}
