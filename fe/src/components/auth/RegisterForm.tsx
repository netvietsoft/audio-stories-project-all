"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerSchema } from "@/lib/validation/auth";
import GoogleOAuthBtn from "./GoogleOAuthBtn";
import { apiClient } from "@/lib/api/api-client";
import { User, Mail, Lock, AlertCircle, CheckCircle2, Loader2, Headphones } from "lucide-react";

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
    const router = useRouter();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormValues) => {
        try {
            setSubmitError(null);
            setSubmitSuccess(null);

            await apiClient.post("/auth/register", {
                email: data.email,
                password: data.password,
                name: data.displayName,
                redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
            });

            setSubmitSuccess("Đăng ký thành công. Vui lòng nhập mã xác thực đã gửi về email.");
            setTimeout(() => {
                router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
            }, 1000);
        } catch (error) {
            const message =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                typeof (error as any).response?.data?.message === "string"
                    ? (error as any).response.data.message
                    : "Đăng ký thất bại. Vui lòng thử lại.";
            setSubmitError(message);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 p-8 md:p-10">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 mb-4">
                        <Headphones className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Đăng ký tài khoản</h1>
                    <p className="text-slate-500 text-sm mt-1">Tham gia cộng đồng nghe truyện audio</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {/* Alerts */}
                    {submitError && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{submitError}</p>
                        </div>
                    )}
                    {submitSuccess && (
                        <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <p>{submitSuccess}</p>
                        </div>
                    )}

                    {/* Display Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Tên hiển thị</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-500 transition-colors">
                                <User className="w-5 h-5" />
                            </div>
                            <input
                                {...register("displayName")}
                                type="text"
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400"
                                placeholder="Ví dụ: TieuDaoTu"
                            />
                        </div>
                        {errors.displayName && <p className="text-red-500 text-xs ml-1">{errors.displayName.message}</p>}
                    </div>

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
                                placeholder="nhap@email.com"
                            />
                        </div>
                        {errors.email && <p className="text-red-500 text-xs ml-1">{errors.email.message}</p>}
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Mật khẩu</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-500 transition-colors">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                {...register("password")}
                                type="password"
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400"
                                placeholder="Ít nhất 6 ký tự"
                            />
                        </div>
                        {errors.password && <p className="text-red-500 text-xs ml-1">{errors.password.message}</p>}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Xác nhận mật khẩu</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-500 transition-colors">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                {...register("confirmPassword")}
                                type="password"
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400"
                                placeholder="Nhập lại mật khẩu"
                            />
                        </div>
                        {errors.confirmPassword && <p className="text-red-500 text-xs ml-1">{errors.confirmPassword.message}</p>}
                    </div>

                    {/* Terms */}
                    <div className="flex items-start gap-3 pt-1">
                        <input
                            id="terms"
                            type="checkbox"
                            {...register("acceptTerms")}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/20"
                        />
                        <label htmlFor="terms" className="text-sm text-slate-600 leading-relaxed">
                            Tôi đồng ý với{" "}
                            <Link href="/terms" className="text-violet-600 hover:text-violet-700 font-medium transition-colors">
                                Điều khoản dịch vụ
                            </Link>{" "}
                            và Chính sách bảo mật.
                        </label>
                    </div>
                    {errors.acceptTerms && <p className="text-red-500 text-xs ml-1">{errors.acceptTerms.message}</p>}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl shadow-lg shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Đăng ký"}
                    </button>
                </form>

                {/* Divider */}
                <div className="my-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-slate-100" />
                    <span className="text-sm text-slate-400">Hoặc</span>
                    <span className="h-px flex-1 bg-slate-100" />
                </div>

                <GoogleOAuthBtn />

                <p className="mt-6 text-center text-sm text-slate-500">
                    Đã có tài khoản?{" "}
                    <Link href="/login" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
                        Đăng nhập ngay
                    </Link>
                </p>
            </div>
        </div>
    );
}