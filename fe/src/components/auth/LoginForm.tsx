"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { loginSchenma } from "@/lib/validation/auth";
import GoogleOAthButton from "./GoogleOAuthBtn";
import { apiClient } from "@/lib/api/api-client";
import { setAuthCookies } from "@/lib/auth/cookies";
import { useUserStore } from "@/stores/user-store";
import { Mail, Lock, Loader2, AlertCircle, LogIn } from "lucide-react";

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

interface LoginFormProps {
    onSuccess?: () => void;
    onSwitchToRegister?: () => void;
    onSwitchToForgot?: () => void;
}

export default function LoginForm({ 
    onSuccess, 
    onSwitchToRegister, 
    onSwitchToForgot 
}: LoginFormProps = {}) {
    const t = useTranslations("LoginForm");
    const tAuth = useTranslations("Auth");
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

            if (onSuccess) {
                onSuccess();
            } else {
                const redirect = searchParams.get("redirect") || "/";
                router.replace(redirect);
            }
        } catch (error) {
            const message: unknown =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                ((typeof (error as any).response?.data?.message === "string") || Array.isArray((error as any).response?.data?.message))
                    ? (error as any).response.data.message
                    : t("submitFailed");
            setSubmitError(Array.isArray(message) ? String(message[0]) : String(message));
        }
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className=" rounded-[32px] p-8 md:p-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                        <LogIn className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>
                    <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Chào mừng bạn trở lại</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {submitError && (
                        <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{submitError}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 ml-1">{t("email")}</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-indigo-500 transition-colors">
                                <Mail className="w-5 h-5" />
                            </div>
                            <input
                                {...register("email")}
                                type="email"
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                                placeholder={t("emailPlaceholder")}
                            />
                        </div>
                        {errors.email && <p className="text-red-500 text-sm mt-1 ml-1">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 ml-1">{t("password")}</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-indigo-500 transition-colors">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                {...register("password")}
                                type="password"
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                                placeholder="••••••••"
                            />
                        </div>
                        {errors.password && <p className="text-red-500 text-sm mt-1 ml-1">{errors.password.message}</p>}
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="flex items-center cursor-pointer group">
                            <input 
                                type="checkbox" 
                                {...register("rememberMe")} 
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer" 
                            />
                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{t("rememberMe")}</span>
                        </label>
                        <Link 
                            href={onSwitchToForgot ? "#" : "/forgot-password"} 
                            onClick={(e) => {
                                if (onSwitchToForgot) {
                                    e.preventDefault();
                                    onSwitchToForgot();
                                }
                            }}
                            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
                        >
                            {t("forgotPassword")}
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 dark:shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                {t("submit")}
                                <LogIn className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 flex items-center justify-center">
                    <span className="h-px w-full bg-gray-200 dark:bg-gray-800"></span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap px-4">{tAuth("or")}</span>
                    <span className="h-px w-full bg-gray-200 dark:bg-gray-800"></span>
                </div>

                <div className="mt-6">
                    <GoogleOAthButton />
                </div>

                <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    {t("noAccount")}{" "}
                    <Link 
                        href={onSwitchToRegister ? "#" : "/register"} 
                        onClick={(e) => {
                            if (onSwitchToRegister) {
                                e.preventDefault();
                                onSwitchToRegister();
                            }
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors"
                    >
                        {t("registerNow")}
                    </Link>
                </p>
            </div>
        </div>
    );
}