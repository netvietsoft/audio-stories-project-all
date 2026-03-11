"use client";

import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';

interface DashboardStats {
    totalUsers: number;
    totalStories: number;
    monthlyRevenue: number;
    growth24h: number;
    activeLast24h: number;
    recentUsers: Array<{
        id: string;
        email: string;
        displayName: string | null;
        createdAt: string;
    }>;
    recentReports: Array<{
        id: string;
        type: string;
        createdAt: string;
        story: { title: string };
        chapter: { chapterNumber: number };
    }>;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await apiClient.get('/auth/admin/stats');
                setStats(res.data);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Vừa xong';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
        return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    };

    const formatCurrency = (val: number) => {
        if (val >= 1000000) {
            return (val / 1000000).toFixed(1) + 'M ₫';
        }
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    };

    const statItems = [
        {
            label: 'Tổng người dùng',
            value: stats?.totalUsers.toLocaleString() || '0',
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            label: 'Số bài viết',
            value: stats?.totalStories.toLocaleString() || '0',
            icon: FileText,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50'
        },
        {
            label: 'Doanh thu tháng',
            value: stats ? formatCurrency(stats.monthlyRevenue) : '0 ₫',
            icon: TrendingUp,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50'
        },
        {
            label: 'Hoạt động 24h',
            value: stats ? `${stats.growth24h > 0 ? '+' : ''}${stats.growth24h}%` : '0%',
            icon: Activity,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            subValue: stats ? `${stats.activeLast24h} users` : ''
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-slate-500 mt-2">Chào mừng bạn trở lại, hệ thống đang hoạt động bình thường.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statItems.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                    {stat.subValue && <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{stat.subValue}</p>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Hoạt động gần đây</h2>
                    <div className="space-y-6">
                        {stats?.recentUsers && stats.recentUsers.length > 0 ? (
                            stats.recentUsers.map((user) => (
                                <div key={user.id} className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                        {(user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-800">
                                            {user.displayName || user.email} vừa đăng ký
                                        </p>
                                        <p className="text-xs text-slate-500">{formatTimeAgo(user.createdAt)}</p>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-500 text-sm text-center py-10">Chưa có hoạt động mới nào.</p>
                        )}
                    </div>
                </div>

                {/* Notifications/Alerts */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Thông báo hệ thống</h2>
                    <div className="space-y-6">
                        {stats?.recentReports && stats.recentReports.length > 0 ? (
                            stats.recentReports.map((report) => (
                                <div key={report.id} className="flex items-start gap-4 p-4 rounded-2xl bg-red-50/50 border border-red-100 group">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-900">Báo lỗi: {report.type}</p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            {report.story.title} - Chương {report.chapter.chapterNumber}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wider">
                                            {formatTimeAgo(report.createdAt)}
                                        </p>
                                    </div>
                                    <div className="px-2 py-1 rounded-md bg-red-100 text-[10px] font-black text-red-700 uppercase">
                                        Mới
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center py-10">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                    <Activity className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Hệ thống ổn định</h3>
                                <p className="text-slate-500 text-sm max-w-[200px]">
                                    Không có báo cáo lỗi hay cảnh báo nào cần xử lý lúc này.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
