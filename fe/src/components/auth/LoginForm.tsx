"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { loginSchenma } from "@/lib/validation/auth";
import GoogleOAthButton from "./GoogleOAuthBtn";
import { apiClient } from "@/lib/api/api-client";
import { setAuthCookies } from "@/lib/auth/cookies";
import { useUserStore } from "@/stores/user-store";
import { Mail, Lock, AlertCircle, Loader2, Headphones } from "lucide-react";

type LoginFormValues = z.infer<typeof loginSchenma>;

type LoginResponse = {
    access_token: string;
    refresh_token: string;
};

type MeResponse = {
    sub: string;
    email: string;
    name?: string | null;
    avatar_url?: string | null;
    roles?: string[];
    vip_tier?: number;
    credits?: number;
    premium_expires_at?: string | null;
};

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const setAuth = useUserStore((state) => state.setAuth);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchenma),
    });

    const [submitError, setSubmitError] = useState<string | null>(null);

    const onSubmit = async (data: LoginFormValues) => {
        try {
            setSubmitError(null);

            const loginRes = await apiClient.post<LoginResponse>("/auth/login", {
                email: data.email,
                password: data.password,
            });

            const { access_token, refresh_token } = loginRes.data;

            const meRes = await apiClient.get<MeResponse>("/auth/me", {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            });

            setAuth({
                user: {
                    id: meRes.data.sub,
                    email: meRes.data.email,
                    name: meRes.data.name ?? undefined,
                    avatarUrl: meRes.data.avatar_url ?? undefined,
                    roles: meRes.data.roles ?? [],
                    vipTier: meRes.data.vip_tier,
                    vipExpirationDate: meRes.data.premium_expires_at,
                    credits: meRes.data.credits ?? 0,
                },
                accessToken: access_token,
                refreshToken: refresh_token,
            });

            setAuthCookies(access_token, refresh_token);

            const redirect = searchParams.get("redirect") || "/";
            router.replace(redirect);
        } catch (error) {
            const message: unknown =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                ((typeof (error as any).response?.data?.message === "string") || Array.isArray((error as any).response?.data?.message))
                    ? (error as any).response.data.message
                    : "Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.";
            setSubmitError(Array.isArray(message) ? String(message[0]) : String(message));
        }
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 p-8 md:p-10">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 mb-4">
                        <Headphones className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
                    <p className="text-slate-500 text-sm mt-1">Chào mừng bạn quay lại!</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {/* Error */}
                    {(submitError || errors.email || errors.password) && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{submitError || errors.email?.message || errors.password?.message}</p>
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Email</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-500 transition-colors">
                                <Mail className="w-5 h-5" />
                            </div>
                            <input
                                {...register("email")}
                                type="email"
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400"
                                placeholder="Nhập email của bạn"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-sm font-semibold text-slate-700">Mật khẩu</label>
                            <Link href="/forgot-password" className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors">
                                Quên mật khẩu?
                            </Link>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-500 transition-colors">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                {...register("password")}
                                type="password"
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {/* Remember me */}
                    <div className="flex items-center gap-2 ml-1">
                        <input
                            type="checkbox"
                            id="rememberMe"
                            {...register("rememberMe")}
                            className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/20"
                        />
                        <label htmlFor="rememberMe" className="text-sm text-slate-600">Ghi nhớ đăng nhập</label>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl shadow-lg shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : "Đăng nhập"}
                    </button>
                </form>

                {/* Divider */}
                <div className="my-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-slate-100" />
                    <span className="text-sm text-slate-400">Hoặc</span>
                    <span className="h-px flex-1 bg-slate-100" />
                </div>

                <GoogleOAthButton />

                <p className="mt-6 text-center text-sm text-slate-500">
                    Chưa có tài khoản?{" "}
                    <Link href="/register" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
                        Đăng ký ngay
                    </Link>
                </p>
            </div>
        </div>
    );
}