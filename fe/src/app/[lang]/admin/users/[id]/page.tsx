"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    User as UserIcon,
    Mail,
    Calendar,
    Shield,
    Star,
    Wallet,
    History,
    Heart,
    CreditCard,
    ArrowLeft,
    Clock,
    MapPin,
    ExternalLink,
    TrendingUp,
    TrendingDown,
    Zap,
    CheckCircle2,
    XCircle,
    Info,
    LayoutDashboard,
    Plus,
    MoreVertical
} from 'lucide-react';
import { adminApiClient } from '@/lib/api/admin-api-client';
import Link from '@/components/shared/LocalizedLink';
import { useTranslations } from 'next-intl';
import { formatChapterTitle, cleanChapterTitle } from '@/lib/formatChapterTitle';

interface UserDetail {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    country: string | null;
    credits: number;
    vipTier: number;
    vipExpirationDate: string | null;
    isActive: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    role: {
        name: string;
        slug: string;
    };
    userFavorites: Array<{
        createdAt: string;
        story: {
            id: string;
            title: string;
            slug: string;
            thumbnailUrl: string | null;
        };
    }>;
    listeningHistory: Array<{
        lastListenedAt: string;
        story: { title: string };
        chapter: { title: string; chapterNumber: number };
    }>;
    creditTransactions: Array<{
        id: string;
        type: string;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        description: string | null;
        createdAt: string;
    }>;
    payments: Array<{
        id: string;
        packageCode: string;
        amountVnd: number;
        creditsAdded: number;
        status: string;
        paidAt: string | null;
        createdAt: string;
    }>;
    memberships: Array<{
        id: string;
        type: string;
        startDate: string;
        endDate: string;
        author?: { name: string };
    }>;
    oauthAccounts: Array<{
        provider: string;
    }>;
}

const UserAvatar = ({ url, name, size = "lg" }: { url: string | null, name: string, size?: "md" | "lg" | "xl" }) => {
    const [imageError, setImageError] = useState(false);
    const sizeClasses = {
        md: "w-12 h-12 rounded-2xl text-lg",
        lg: "w-20 h-20 rounded-[24px] text-2xl",
        xl: "w-32 h-32 rounded-[40px] text-4xl"
    };

    return (
        <div className={`${sizeClasses[size]} flex-shrink-0 bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden shadow-inner border-2 border-white ring-4 ring-slate-50`}>
            {url && !imageError ? (
                <img src={url} alt="" className="w-full h-full object-cover" onError={() => setImageError(true)} />
            ) : (
                name[0]?.toUpperCase() || '?'
            )}
        </div>
    );
};

const StatusBadge = ({ active }: { active: boolean }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></span>
        {active ? 'Đang hoạt động' : 'Bị khóa'}
    </span>
);

export default function UserDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [user, setUser] = useState<UserDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [creditsInput, setCreditsInput] = useState('0');
    const [isUpdatingCredits, setIsUpdatingCredits] = useState(false);
    const [creditsMessage, setCreditsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const tChapter = useTranslations("StoryChapterClient");

    useEffect(() => {
        if (id) fetchUser();
    }, [id]);

    const fetchUser = async () => {
        setIsLoading(true);
        try {
            const res = await adminApiClient.get(`/auth/users/${id}`);
            setUser(res.data);
            setCreditsInput(String(Math.max(0, Math.floor(res.data?.credits || 0))));
        } catch (error) {
            console.error('Failed to fetch user:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetCredits = async () => {
        if (!user?.id || isUpdatingCredits) return;

        const parsedCredits = Number(creditsInput);
        if (!Number.isFinite(parsedCredits) || parsedCredits < 0) {
            setCreditsMessage({ type: 'error', text: 'Credits phải là số không âm.' });
            return;
        }

        const normalizedCredits = Math.floor(parsedCredits);

        setIsUpdatingCredits(true);
        setCreditsMessage(null);

        try {
            const res = await adminApiClient.patch(`/auth/users/${user.id}/credits`, {
                credits: normalizedCredits,
            });

            const nextCredits = Number(res.data?.data?.credits ?? normalizedCredits);

            setUser((prev) => (prev ? { ...prev, credits: nextCredits } : prev));
            setCreditsInput(String(nextCredits));
            setCreditsMessage({ type: 'success', text: 'Cập nhật credits thành công.' });
        } catch (error) {
            console.error('Failed to update user credits:', error);
            setCreditsMessage({ type: 'error', text: 'Không thể cập nhật credits. Vui lòng thử lại.' });
        } finally {
            setIsUpdatingCredits(false);
        }
    };

    const formatDate = (dateString: string | null, includeTime = false) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            ...(includeTime && { hour: '2-digit', minute: '2-digit' })
        }).format(date);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold animate-pulse">Đang tải thông tin người dùng...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Không tìm thấy người dùng</h2>
                <p className="text-slate-500 mt-2 mb-6">Dữ liệu người dùng này không tồn tại hoặc đã bị xóa.</p>
                <button onClick={() => router.back()} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
                    Quay lại danh sách
                </button>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
        { id: 'transactions', label: 'Giao dịch', icon: Wallet },
        { id: 'activity', label: 'Hoạt động', icon: Zap },
        { id: 'billing', label: 'Thanh toán', icon: CreditCard },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header / Breadcrumb */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold group"
                >
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-slate-300 transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    Quay lại
                </button>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all">
                        Chặn người dùng
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                        Chỉnh sửa
                    </button>
                </div>
            </div>

            {/* Profile Hero Card */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/40 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                    <StatusBadge active={user.isActive} />
                </div>

                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                    <UserAvatar url={user.avatarUrl} name={user.displayName || user.email} size="xl" />
                    <div className="flex-1 space-y-4">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center justify-center md:justify-start gap-3">
                                {user.displayName || 'Chưa đặt tên'}
                                {user.vipTier > 0 && (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-sm font-bold">
                                        <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                                        VIP {user.vipTier}
                                    </span>
                                )}
                            </h1>
                            <p className="text-xl text-slate-500 font-medium mt-1">{user.email}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-3 pt-2">
                            <div className="flex items-center gap-2 text-slate-500 font-bold">
                                <Shield className="w-5 h-5 text-indigo-500" />
                                <span className="uppercase tracking-wider text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-100">
                                    {user.role.name}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                                <MapPin className="w-5 h-5 text-slate-400" />
                                {user.country || 'Quốc tịch ẩn'}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                                <Calendar className="w-5 h-5 text-slate-400" />
                                Tham gia: {formatDate(user.createdAt)}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                                <Clock className="w-5 h-5 text-slate-400" />
                                Truy cập cuối: {user.lastLoginAt ? formatDate(user.lastLoginAt, true) : 'Chưa từng'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="grid w-full max-w-md grid-cols-2 gap-1.5 rounded-3xl border border-slate-200/60 bg-slate-100/50 p-1.5 shadow-inner mx-auto md:mx-0 md:w-auto md:max-w-fit md:grid-cols-4">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-center text-sm font-bold transition-all
                            ${activeTab === tab.id
                                ? 'bg-white text-indigo-600 shadow-md transform scale-[1.02]'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}
                        `}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-8">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Summary Stats */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm group hover:shadow-lg transition-all duration-500">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Wallet className="w-7 h-7" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tín dụng hiện tại</p>
                                            <h3 className="text-2xl font-black text-slate-900">{user.credits.toLocaleString()}</h3>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 w-[65%]" />
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm group hover:shadow-lg transition-all duration-500">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Star className="w-7 h-7" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cấp độ VIP</p>
                                            <h3 className="text-2xl font-black text-slate-900">{user.vipTier > 0 ? `VIP ${user.vipTier}` : 'THƯỜNG'}</h3>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        {user.vipExpirationDate ? `Hạn dùng: ${formatDate(user.vipExpirationDate)}` : 'Chưa nâng cấp VIP'}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activities Section */}
                            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <History className="w-5 h-5 text-indigo-500" />
                                        Hoạt động gần đây
                                    </h3>
                                    <button onClick={() => setActiveTab('activity')} className="text-indigo-600 text-xs font-bold hover:underline">Xem thêm</button>
                                </div>
                                <div className="p-4">
                                    {user.listeningHistory.length > 0 ? (
                                        <div className="space-y-3">
                                            {user.listeningHistory.slice(0, 5).map((history, i) => (
                                                <div key={i} className="rounded-2xl border border-transparent p-4 transition-all hover:border-slate-100 hover:bg-slate-50">
                                                    <div className="flex items-start gap-4">
                                                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                                            <Clock className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 space-y-2">
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-bold leading-5 text-slate-900 break-words">{history.story.title}</p>
                                                                <p className="text-xs leading-5 text-slate-500 break-words">
                                                                    {formatChapterTitle(tChapter("chapterKeyword"), history.chapter.chapterNumber, cleanChapterTitle(history.chapter.title))}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">Moi nhat</span>
                                                                <span>{formatDate(history.lastListenedAt, true)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Zap className="w-8 h-8" />
                                            </div>
                                            <p className="text-slate-400 font-bold">Chưa có lịch sử nghe</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar info */}
                        <div className="space-y-8">
                            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Set credits</h3>

                                <div className="space-y-3">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Credits hiện tại</p>
                                        <p className="mt-1 text-2xl font-black text-slate-900">{user.credits.toLocaleString()}</p>
                                    </div>

                                    <div>
                                        <label htmlFor="user-credits-input" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Credits mới
                                        </label>
                                        <input
                                            id="user-credits-input"
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={creditsInput}
                                            onChange={(e) => setCreditsInput(e.target.value)}
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Nhập credits"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSetCredits}
                                        disabled={isUpdatingCredits}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-60"
                                    >
                                        {isUpdatingCredits ? (
                                            <>
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                                Đang cập nhật...
                                            </>
                                        ) : (
                                            <>
                                                <Wallet className="w-4 h-4" />
                                                Lưu credits
                                            </>
                                        )}
                                    </button>

                                    {creditsMessage ? (
                                        <p
                                            className={`rounded-xl px-3 py-2 text-xs font-bold ${
                                                creditsMessage.type === 'success'
                                                    ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                                                    : 'border border-rose-100 bg-rose-50 text-rose-700'
                                            }`}
                                        >
                                            {creditsMessage.text}
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            {/* Favorites Circle */}
                            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Yêu thích</h3>
                                <div className="relative w-32 h-32 mx-auto mb-6">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                                        <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * Math.min(user.userFavorites.length, 100) / 100)} className="text-rose-500" strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <Heart className="w-6 h-6 text-rose-500 fill-rose-500 mb-1" />
                                        <span className="text-2xl font-black text-slate-900">{user.userFavorites.length}</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {user.userFavorites.slice(0, 3).map((fav, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                            <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                                                {fav.story.thumbnailUrl ? (
                                                    <img src={fav.story.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                ) : <Heart className="w-4 h-4 m-3 text-slate-300" />}
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 truncate text-left flex-1">{fav.story.title}</p>
                                        </div>
                                    ))}
                                    {user.userFavorites.length > 3 && (
                                        <p className="text-[10px] text-slate-400 font-bold italic">+ {user.userFavorites.length - 3} truyện khác</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                        <div className="p-8 border-b border-slate-100">
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <Wallet className="w-8 h-8 text-indigo-500" />
                                Lịch sử tín dụng
                            </h3>
                            <p className="text-slate-500 font-medium mt-1">Chi tiết sử dụng và nạp tín dụng của người dùng</p>
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Loại giao dịch</th>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Nội dung</th>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Số lượng</th>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Số dư mới</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {user.creditTransactions.length > 0 ? user.creditTransactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-6">
                                                <p className="text-sm font-bold text-slate-900">{formatDate(tx.createdAt, true)}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-tight
                                                    ${tx.type === 'topup' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                        tx.type === 'spend' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                                            'bg-indigo-50 text-indigo-700 border border-indigo-100'}
                                                `}>
                                                    {tx.type === 'topup' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                    {tx.type === 'topup' ? 'Nạp tiền' : tx.type === 'spend' ? 'Chi tiêu' : tx.type}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 max-w-xs">
                                                <p className="text-sm font-medium text-slate-600 line-clamp-1">{tx.description || 'Không có mô tả'}</p>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <p className={`text-base font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <p className="text-sm font-bold text-slate-900">
                                                    {tx.balanceAfter.toLocaleString()}
                                                </p>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-16 text-center text-slate-400 font-bold">
                                                Chưa có giao dịch nào được ghi nhận.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-slate-100 md:hidden">
                            {user.creditTransactions.length > 0 ? user.creditTransactions.map(tx => (
                                <div key={tx.id} className="space-y-4 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Thời gian</p>
                                            <p className="text-sm font-bold leading-6 text-slate-900 break-words">{formatDate(tx.createdAt, true)}</p>
                                        </div>
                                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black uppercase tracking-tight
                                            ${tx.type === 'topup' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                tx.type === 'spend' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                                    'bg-indigo-50 text-indigo-700 border border-indigo-100'}
                                        `}>
                                            {tx.type === 'topup' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                            {tx.type === 'topup' ? 'Nạp tiền' : tx.type === 'spend' ? 'Chi tiêu' : tx.type}
                                        </span>
                                    </div>

                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Nội dung</p>
                                        <p className="mt-2 text-sm font-medium leading-6 text-slate-700 break-words">{tx.description || 'Không có mô tả'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Số lượng</p>
                                            <p className={`mt-2 text-lg font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Số dư mới</p>
                                            <p className="mt-2 text-lg font-black text-slate-900">{tx.balanceAfter.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="px-8 py-16 text-center text-slate-400 font-bold">
                                    Chưa có giao dịch nào được ghi nhận.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Favorites */}
                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-8">
                            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                                <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
                                Truyện đã thích
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {user.userFavorites.length > 0 ? user.userFavorites.map((fav, i) => (
                                    <div key={i} className="group p-4 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 hover:bg-white transition-all">
                                        <div className="aspect-[3/4] rounded-2xl bg-slate-200 mb-3 overflow-hidden shadow-inner flex items-center justify-center">
                                            {fav.story.thumbnailUrl ? (
                                                <img src={fav.story.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            ) : <Heart className="w-8 h-8 text-slate-300" />}
                                        </div>
                                        <p className="text-sm font-black text-slate-900 truncate">{fav.story.title}</p>
                                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">Thêm vào: {formatDate(fav.createdAt)}</p>
                                    </div>
                                )) : (
                                    <div className="col-span-2 text-center py-12 text-slate-400 font-bold">Chưa có truyện yêu thích</div>
                                )}
                            </div>
                        </div>

                        {/* Full Listening History */}
                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-slate-100">
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    <Clock className="w-7 h-7 text-indigo-500" />
                                    Lịch sử nghe truyện
                                </h3>
                            </div>
                            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                                {user.listeningHistory.length > 0 ? user.listeningHistory.map((history, i) => (
                                    <div key={i} className="flex gap-4 p-4 rounded-3xl hover:bg-slate-50 transition-all group">
                                        <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shadow-sm group-hover:text-indigo-500 group-hover:border-indigo-100 transition-all">
                                            <History className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-900 truncate">{history.story.title}</p>
                                            <p className="text-xs text-slate-500 font-bold mt-1">Chương {history.chapter.chapterNumber}: {history.chapter.title}</p>
                                            <p className="text-[10px] text-indigo-400 font-bold mt-2 uppercase tracking-widest">{formatDate(history.lastListenedAt, true)}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-12 text-slate-400 font-bold">Chưa có lịch sử nghe</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'billing' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                        {/* Summary VIP & Membership info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8 items-center">
                                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 shadow-inner">
                                    <Star className="w-12 h-12 fill-amber-500" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cấp độ VIP hiện tại</h4>
                                    <h3 className="text-3xl font-black text-slate-900 mb-2">{user.vipTier > 0 ? `VIP Level ${user.vipTier}` : 'THÀNH VIÊN THƯỜNG'}</h3>
                                    <p className="text-sm font-bold text-slate-500">
                                        {user.vipExpirationDate ? `Hạn dùng đến ngày ${formatDate(user.vipExpirationDate)}` : 'Nâng cấp VIP để nhận thêm nhiều ưu đãi đặc quyền.'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-4">Hội viên tác giả</h4>
                                <div className="space-y-4">
                                    {user.memberships.length > 0 ? user.memberships.map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <Zap className="w-5 h-5 text-indigo-500" />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">{m.type === 'all_authors' ? 'Tất cả tác giả' : m.author?.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">Hết hạn: {formatDate(m.endDate)}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">Đang hoạt động</span>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-slate-400 font-bold italic text-center py-4">Chưa tham gia hội viên nào</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Payments Table */}
                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-slate-100">
                                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                    <CreditCard className="w-8 h-8 text-indigo-500" />
                                    Lịch sử nạp tiền
                                </h3>
                            </div>
                            <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Loại giao dịch</th>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Nội dung</th>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Số lượng</th>
                                        <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Số dư mới</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {user.creditTransactions.length > 0 ? user.creditTransactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-6">
                                                <p className="text-sm font-bold text-slate-900">{formatDate(tx.createdAt, true)}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-tight
                                                    ${tx.type === 'topup' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                        tx.type === 'spend' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                                            'bg-indigo-50 text-indigo-700 border border-indigo-100'}
                                                `}>
                                                    {tx.type === 'topup' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                    {tx.type === 'topup' ? 'Nạp tiền' : tx.type === 'spend' ? 'Chi tiêu' : tx.type}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 max-w-xs">
                                                <p className="text-sm font-medium text-slate-600 line-clamp-1">{tx.description || 'Không có mô tả'}</p>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <p className={`text-base font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <p className="text-sm font-bold text-slate-900">
                                                    {tx.balanceAfter.toLocaleString()}
                                                </p>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-16 text-center text-slate-400 font-bold">
                                                Chưa có giao dịch nào được ghi nhận.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-slate-100 md:hidden">
                            {user.creditTransactions.length > 0 ? user.creditTransactions.map(tx => (
                                <div key={tx.id} className="space-y-4 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Thời gian</p>
                                            <p className="text-sm font-bold leading-6 text-slate-900 break-words">{formatDate(tx.createdAt, true)}</p>
                                        </div>
                                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black uppercase tracking-tight
                                            ${tx.type === 'topup' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                tx.type === 'spend' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                                    'bg-indigo-50 text-indigo-700 border border-indigo-100'}
                                        `}>
                                            {tx.type === 'topup' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                            {tx.type === 'topup' ? 'Nạp tiền' : tx.type === 'spend' ? 'Chi tiêu' : tx.type}
                                        </span>
                                    </div>

                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Nội dung</p>
                                        <p className="mt-2 text-sm font-medium leading-6 text-slate-700 break-words">{tx.description || 'Không có mô tả'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Số lượng</p>
                                            <p className={`mt-2 text-lg font-black ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Số dư mới</p>
                                            <p className="mt-2 text-lg font-black text-slate-900">{tx.balanceAfter.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="px-8 py-16 text-center text-slate-400 font-bold">
                                    Chưa có giao dịch nào được ghi nhận.
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}





