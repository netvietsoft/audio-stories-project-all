"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Coins, ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';

export default function TopupSuccessPage() {
    const router = useRouter();
    const [userData, setUserData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const res = await apiClient.get('/auth/me');
            setUserData(res.data);
        } catch (error) {
            console.error('Failed to fetch user data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                {/* Success Card */}
                <div className="bg-white dark:bg-gray-800 rounded-[40px] shadow-2xl shadow-emerald-200/40 dark:shadow-emerald-900/20 p-8 sm:p-12 text-center border-2 border-emerald-100 dark:border-emerald-900/30">
                    {/* Success Icon */}
                    <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-6 animate-in zoom-in duration-500">
                        <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 text-emerald-600 dark:text-emerald-400" />
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-gray-100 mb-3 tracking-tight">
                        Thanh toán thành công!
                    </h1>
                    <p className="text-slate-600 dark:text-gray-300 text-base sm:text-lg font-medium mb-8">
                        Credits đã được cộng vào tài khoản của bạn
                    </p>

                    {/* Credits Display */}
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-3xl p-6 sm:p-8 mb-8 border-2 border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex items-center justify-center gap-3 mb-2">
                            <Coins className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">
                                Số dư hiện tại
                            </span>
                        </div>
                        <div className="text-5xl sm:text-6xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                            {userData?.credits?.toLocaleString() || '0'}
                        </div>
                        <div className="text-sm font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mt-2">
                            Credits
                        </div>
                    </div>

                    {/* User Info */}
                    {userData && (
                        <div className="bg-slate-50 dark:bg-gray-700/50 rounded-2xl p-4 mb-8 text-left">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-bold text-slate-500 dark:text-gray-400">Tài khoản:</span>
                                <span className="font-black text-slate-900 dark:text-gray-100">{userData.email}</span>
                            </div>
                            {userData.displayName && (
                                <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="font-bold text-slate-500 dark:text-gray-400">Tên hiển thị:</span>
                                    <span className="font-black text-slate-900 dark:text-gray-100">{userData.displayName}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="flex-1 py-4 px-6 bg-emerald-600 dark:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-wide hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 flex items-center justify-center gap-2"
                        >
                            Về trang chủ
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => router.push('/topup')}
                            className="flex-1 py-4 px-6 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 rounded-2xl font-black text-sm uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-gray-600 transition-all active:scale-95 border-2 border-slate-200 dark:border-gray-600 flex items-center justify-center gap-2"
                        >
                            <Coins className="w-5 h-5" />
                            Nạp thêm
                        </button>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="text-center mt-6 text-sm text-slate-500 dark:text-gray-400 font-medium">
                    <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
                </div>
            </div>
        </div>
    );
}
