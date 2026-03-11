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

            const redirect = searchParams.get("redirect") || "/";
            router.replace(redirect);
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
        <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
            <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {submitError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
                )}
                <div>
                    <label className="block text-sm font-medium mb-1">{t("email")}</label>
                    <input 
                        {...register("email")}
                        type="email"
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        placeholder={t("emailPlaceholder")}
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">{t("password")}</label>
                    <input 
                        {...register("password")}
                        type="password"
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
                </div>
                <div className="flex items-center justify-between">
                    <label className="flex items-center">
                        <input type="checkbox" {...register("rememberMe")} className="rounded border-gray-300" />
                        <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">{t("rememberMe")}</span>
                    </label>
                    <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">{t("forgotPassword")}</Link>
                </div>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50">
                    {isSubmitting ? tAuth("processing") : t("submit")}
                </button>
            </form>

            <div className="mt-6 flex items-center justify-center">
                <span>{tAuth("or")}</span>
            </div>

            <div className="mt-4">
                <GoogleOAthButton />
            </div>

            <p className="mt-4 text-center text-sm">
                {t("noAccount")} <Link href="/register" className="text-blue-600 hover:underline">{t("registerNow")}</Link>
            </p>
        </div>
    );
}