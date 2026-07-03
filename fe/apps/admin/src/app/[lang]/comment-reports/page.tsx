"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  MessageSquareWarning,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList, unwrapData } from '@/lib/api/unwrap';

type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

type Reporter = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type ReportRow = {
  id: string;
  reason: string;
  status: ReportStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: Reporter | null;
  comment: {
    id: string;
    content: string;
    isHidden: boolean;
    timestampSeconds: number | null;
    user: Reporter;
    story: {
      id: string;
      title: string;
      slug: string;
    };
    chapter: {
      id: string;
      title: string;
      chapterNumber: number;
    };
  };
};

type ReportResponse = {
  data: ReportRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type Stats = {
  totalReports: number;
  pendingReports: number;
  reviewedReports: number;
  resolvedReports: number;
  dismissedReports: number;
};

const STATUS_OPTIONS: Array<{ value: ReportStatus | ''; label: string }> = [
  { value: '', label: 'Tat ca trang thai' },
  { value: 'pending', label: 'Cho xu ly' },
  { value: 'reviewed', label: 'Dang xem xet' },
  { value: 'resolved', label: 'Da xu ly' },
  { value: 'dismissed', label: 'Bo qua' },
];

const STATUS_BADGE: Record<ReportStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  reviewed: 'bg-sky-50 text-sky-700 border-sky-100',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  dismissed: 'bg-slate-100 text-slate-700 border-slate-200',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: 'Cho xu ly',
  reviewed: 'Dang xem xet',
  resolved: 'Da xu ly',
  dismissed: 'Bo qua',
};

export default function CommentReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReportStatus | ''>('pending');

  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [nextStatus, setNextStatus] = useState<ReportStatus>('reviewed');
  const [hideComment, setHideComment] = useState(true);
  const [adminNote, setAdminNote] = useState('');

  const pageSize = 20;

  useEffect(() => {
    void fetchData();
  }, [page, search, status]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
      });

      const [listRes, statsRes] = await Promise.all([
        apiClient.get<ReportResponse>(`/comments/reports?${params.toString()}`),
        apiClient.get<Stats>('/comments/reports/stats'),
      ]);

      setRows(unwrapList<ReportRow>(listRes.data));
      const meta = (listRes.data as any)?.data?.meta ?? (listRes.data as any)?.meta;
      setTotal(meta?.total ?? 0);
      setTotalPages(meta?.totalPages || 1);
      setStats(unwrapData<Stats>(statsRes.data));
    } catch (error) {
      console.error('Failed to fetch comment reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openUpdateModal = (row: ReportRow) => {
    setSelectedReport(row);
    setNextStatus(row.status === 'pending' ? 'reviewed' : row.status);
    setHideComment(row.comment.isHidden);
    setAdminNote(row.adminNote || '');
  };

  const closeModal = () => {
    setSelectedReport(null);
    setAdminNote('');
  };

  const updateReport = async () => {
    if (!selectedReport) return;

    setUpdatingId(selectedReport.id);
    try {
      await apiClient.patch(`/comments/reports/${selectedReport.id}`, {
        status: nextStatus,
        hideComment,
        adminNote: adminNote.trim() || undefined,
      });

      closeModal();
      await fetchData();
    } catch (error) {
      console.error('Failed to update report:', error);
      alert('Khong the cap nhat bao cao. Vui long thu lai.');
    } finally {
      setUpdatingId(null);
    }
  };

  const statsCards = useMemo(
    () => [
      {
        title: 'Tong bao cao',
        value: stats?.totalReports || 0,
        icon: MessageSquareWarning,
        style: 'bg-violet-50 text-violet-700',
      },
      {
        title: 'Cho xu ly',
        value: stats?.pendingReports || 0,
        icon: AlertTriangle,
        style: 'bg-amber-50 text-amber-700',
      },
      {
        title: 'Dang xem xet',
        value: stats?.reviewedReports || 0,
        icon: Eye,
        style: 'bg-sky-50 text-sky-700',
      },
      {
        title: 'Da xu ly',
        value: stats?.resolvedReports || 0,
        icon: CheckCircle2,
        style: 'bg-emerald-50 text-emerald-700',
      },
    ],
    [stats],
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-200">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            Xu ly Bao cao Binh luan
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Kiem duyet bao cao tu nguoi dung va xu ly comment vi pham.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.style}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.title}</p>
                  <p className="text-2xl font-black text-slate-900">{card.value.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tim theo ly do, noi dung comment, email..."
            className="w-full bg-slate-50 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium border border-transparent focus:border-slate-200 focus:outline-none"
          />
        </div>

        <div className="relative min-w-[220px]">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ReportStatus | '');
              setPage(1);
            }}
            className="w-full bg-slate-50 rounded-2xl py-3 pl-12 pr-8 text-sm font-medium border border-transparent focus:border-slate-200 focus:outline-none appearance-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-white rounded-[28px] border border-slate-200 p-6 animate-pulse h-32" />
          ))
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-[28px] border border-slate-200 p-20 text-center">
            <MessageSquareWarning className="w-10 h-10 mx-auto text-slate-300" />
            <h3 className="mt-4 text-lg font-bold text-slate-900">Chua co bao cao nao</h3>
            <p className="mt-1 text-slate-500">Danh sach bao cao se hien thi tai day.</p>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-lg border ${STATUS_BADGE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleString('vi-VN')}
                    </span>
                    {row.comment.isHidden ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                        <EyeOff className="w-3 h-3" />
                        Da an comment
                      </span>
                    ) : null}
                  </div>

                  <div className="text-sm text-slate-500">
                    Reporter: <span className="font-semibold text-slate-700">{row.user?.displayName || row.user?.email || 'Unknown'}</span>
                  </div>

                  <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3">
                    <p className="text-xs uppercase font-bold text-rose-700 mb-1">Ly do bao cao</p>
                    <p className="text-sm text-rose-900 whitespace-pre-wrap">{row.reason}</p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                    <p className="text-xs uppercase font-bold text-slate-500 mb-1">Comment bi bao cao</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{row.comment.content}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {row.comment.user.displayName} • {row.comment.story.title} • Chuong {row.comment.chapter.chapterNumber}
                    </p>
                  </div>

                  {row.adminNote ? (
                    <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-3">
                      <p className="text-xs uppercase font-bold text-indigo-700 mb-1">Ghi chu admin</p>
                      <p className="text-sm text-indigo-900 whitespace-pre-wrap">{row.adminNote}</p>
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0">
                  <button
                    onClick={() => openUpdateModal(row)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
                  >
                    Xu ly
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-5 py-4">
        <p className="text-sm text-slate-500 font-medium">
          Hien thi {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} / {total} bao cao
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1.5 text-sm font-semibold text-slate-700">
            {page} / {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {selectedReport ? (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-xl p-6 space-y-5">
            <div>
              <h3 className="text-xl font-black text-slate-900">Xu ly bao cao</h3>
              <p className="text-sm text-slate-500 mt-1">Cap nhat trang thai va hanh dong voi comment.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Trang thai</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as ReportStatus)}
                  className="mt-2 w-full bg-slate-50 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="pending">Cho xu ly</option>
                  <option value="reviewed">Dang xem xet</option>
                  <option value="resolved">Da xu ly</option>
                  <option value="dismissed">Bo qua</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Hien thi comment</label>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => setHideComment(false)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                      !hideComment
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-4 h-4" /> Hien
                    </span>
                  </button>
                  <button
                    onClick={() => setHideComment(true)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                      hideComment
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <EyeOff className="w-4 h-4" /> An
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Ghi chu admin</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={4}
                className="mt-2 w-full bg-slate-50 rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none"
                placeholder="Nhap ghi chu xu ly (khong bat buoc)"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Huy
              </button>
              <button
                onClick={updateReport}
                disabled={updatingId === selectedReport.id}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
              >
                {updatingId === selectedReport.id ? 'Dang luu...' : 'Luu xu ly'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

