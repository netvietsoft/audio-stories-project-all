"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { adminApiClient, ADMIN_ACCESS_TOKEN_KEY } from '@/lib/api/admin-api-client';
import { useAdminStore } from '@/stores/admin-store';

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const setAuth = useAdminStore((state) => state.setAuth);

    useEffect(() => {
        const reason = searchParams.get('reason');
        if (reason === 'unauthorized') {
            setError('Tài khoản của bạn không có quyền truy cập vào bảng điều khiển Admin.');
        } else if (reason === 'expired') {
            setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
    }, [searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // 1. Call real login API
            const loginRes = await adminApiClient.post('/auth/login', { email, password });

            // BE bọc response trong { data: ... } -> access_token ở loginRes.data.data
            const loginBody: any = loginRes.data?.data ?? loginRes.data;
            const access_token = loginBody?.access_token;

            if (access_token) {
                // 2. Fetch user info to verify role
                const meRes = await adminApiClient.get('/auth/me', {
                    headers: { Authorization: `Bearer ${access_token}` }
                });

                const userData: any = meRes.data?.data ?? meRes.data;

                // Check for ADMIN role
                if (userData.role === 'ADMIN' || userData.roles?.includes('ADMIN')) {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, access_token);
                        localStorage.setItem('adminLoggedIn', 'true');
                        localStorage.setItem('userEmail', email);
                    }

                    // Update admin store
                    setAuth({
                        user: {
                            id: userData.sub,
                            email: userData.email,
                            name: userData.name,
                            avatarUrl: userData.avatar_url,
                            roles: userData.roles,
                            credits: userData.credits || 0,
                            vipTier: userData.vip_tier,
                            vipExpirationDate: userData.premium_expires_at,
                        },
                        accessToken: access_token,
                    });

                    router.push('/');
                    router.refresh();
                } else {
                    // Not an admin
                    setError('Bạn không có quyền truy cập trang quản trị.');
                    // Clear what we just set
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('adminLoggedIn');
                    }
                    useAdminStore.getState().clearAuth();
                }
            } else {
                setError('Đăng nhập không thành công.');
            }
        } catch (err: any) {
            const message = err.response?.data?.message || 'Tài khoản hoặc mật khẩu không chính xác.';
            setError(message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 p-8 md:p-10">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                            <Shield className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Admin Login</h1>
                        <p className="text-slate-500 text-sm mt-1">Truy cập hệ thống quản trị</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
                                    placeholder="Nhập email quản trị"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Đăng nhập
                                    <Shield className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 grid space-y-3 justify-center">
                        <p className='text-sm text-gray-500' >admin@truyen-audio.app</p>
                        <p className='text-sm text-center text-gray-500'>admin123</p>
                        <button
                            onClick={() => router.push('/')}
                            className="text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors"
                        >
                            ← Trở về trang chủ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
