"use client";

import React, { useState, useEffect } from 'react';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    TrendingUp,
    Clock,
    XCircle,
    CheckCircle,
    Filter,
    Trash2,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';

interface Payment {
    id: string;
    userId: string;
    packageCode: string;
    amountVnd: number;
    creditsAdded: number;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    transactionCode: string | null;
    paidAt: string | null;
    createdAt: string;
    user: {
        id: string;
        email: string;
        displayName: string;
    };
}

interface Stats {
    totalRevenue: number;
    successCount: number;
    pendingCount: number;
    failedCount: number;
}

export default function TransactionsPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const limit = 20;

    useEffect(() => {
        fetchPayments();
        fetchStats();
    }, [page, searchTerm, statusFilter]);

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(searchTerm && { search: searchTerm }),
                ...(statusFilter && { status: statusFilter }),
            });
            const res = await apiClient.get(`/transactions/payments?${params}`);
            setPayments(res.data.data);
            setTotal(res.data.meta.total);
            setTotalPages(res.data.meta.totalPages);
        } catch (error) {
            console.error('Failed to fetch payments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await apiClient.get('/transactions/stats');
            setStats(res.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const handleDelete = async (paymentId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
            return;
        }

        setDeletingId(paymentId);
        try {
            await apiClient.delete(`/transactions/payments/${paymentId}`);
            await fetchPayments();
            await fetchStats();
        } catch (error) {
            console.error('Failed to delete payment:', error);
            alert('Không thể xóa giao dịch. Vui lòng thử lại.');
        } finally {
            setDeletingId(null);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        <CheckCircle className="w-3 h-3" /> Thành công
                    </span>
                );
            case 'PENDING':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                        <Clock className="w-3 h-3" /> Đang chờ
                    </span>
                );
            case 'FAILED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-100 text-[10px] font-black text-red-600 uppercase tracking-widest">
                        <XCircle className="w-3 h-3" /> Thất bại
                    </span>
                );
            case 'CANCELLED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        <XCircle className="w-3 h-3" /> Đã hủy
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Giao dịch
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Theo dõi và quản lý tất cả giao dịch thanh toán
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Tổng doanh thu</p>
                                <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Thành công</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.successCount.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Đang chờ</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.pendingCount.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                                <XCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Thất bại</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.failedCount.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Filter */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm theo email, tên, mã giao dịch..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <div className="relative min-w-0">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-8 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer md:min-w-[200px]"
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="SUCCESS">Thành công</option>
                        <option value="PENDING">Đang chờ</option>
                        <option value="FAILED">Thất bại</option>
                        <option value="CANCELLED">Đã hủy</option>
                    </select>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Người dùng</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Gói</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Số tiền</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Credits</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Mã GD</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                                <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={8} className="px-8 py-6">
                                            <div className="h-12 bg-slate-50 rounded-2xl" />
                                        </td>
                                    </tr>
                                ))
                            ) : payments.length > 0 ? (
                                payments.map((payment) => (
                                    <tr key={payment.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-900">{payment.user.displayName}</p>
                                            <p className="text-xs font-medium text-slate-400 mt-0.5">{payment.user.email}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                                {payment.packageCode}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-emerald-600">{formatCurrency(payment.amountVnd)}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-bold text-slate-900">+{payment.creditsAdded.toLocaleString()}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            {getStatusBadge(payment.status)}
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-xs font-mono text-slate-500">
                                                {payment.transactionCode || '-'}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-xs font-medium text-slate-500">
                                                {formatDate(payment.paidAt || payment.createdAt)}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleDelete(payment.id)}
                                                    disabled={deletingId === payment.id}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                                    title="Xóa giao dịch"
                                                >
                                                    <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-8 py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <DollarSign className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Chưa có giao dịch nào</h3>
                                        <p className="text-slate-500 mt-1">Các giao dịch sẽ hiển thị ở đây.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                    {isLoading ? (
                        Array(4).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse p-4">
                                <div className="h-24 rounded-2xl bg-slate-50" />
                            </div>
                        ))
                    ) : payments.length > 0 ? (
                        payments.map((payment) => (
                            <div key={payment.id} className="p-4">
                                <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-slate-900 break-words">{payment.user.displayName}</p>
                                            <p className="mt-1 text-xs font-medium text-slate-400 break-all">{payment.user.email}</p>
                                            <p className="mt-2 text-[11px] font-medium text-slate-400">{formatDate(payment.paidAt || payment.createdAt)}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(payment.id)}
                                            disabled={deletingId === payment.id}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-600 transition-all hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Xoa giao dich"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex rounded-xl border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600">
                                            {payment.packageCode}
                                        </span>
                                        {getStatusBadge(payment.status)}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">So tien</p>
                                            <p className="mt-1 text-sm font-black text-emerald-600">{formatCurrency(payment.amountVnd)}</p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Credits</p>
                                            <p className="mt-1 text-sm font-bold text-slate-900">+{payment.creditsAdded.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ma GD</p>
                                        <p className="mt-1 break-all font-mono text-xs text-slate-600">{payment.transactionCode || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-8 py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <DollarSign className="w-6 h-6 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Chua co giao dich nao</h3>
                            <p className="text-slate-500 mt-1">Cac giao dich se hien thi o day.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Trang {page} / {totalPages} (Tổng {total} giao dịch)
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

