"use client";

import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';

interface DashboardStats {
    totalUsers: number;
    totalStories: number;
    monthlyRevenue: number;
    growth24h: number;
    activeLast24h: number;
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
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Hoạt động gần đây</h2>
                    <div className="space-y-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                                    U{i}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-800">Người dùng mới vừa đăng ký</p>
                                    <p className="text-xs text-slate-500">2 giờ trước</p>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                        <Activity className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Chưa có thông báo mới</h2>
                    <p className="text-slate-500 max-w-xs">
                        Hiện tại hệ thống không có cảnh báo hay thông báo quan trọng nào cần xử lý.
                    </p>
                </div>
            </div>
        </div>
    );
}
