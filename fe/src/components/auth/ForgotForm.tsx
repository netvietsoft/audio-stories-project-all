"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { forgotShema } from "@/lib/validation/auth";
import Link from "next/link";
import { apiClient } from "@/lib/api/api-client";
import { Mail, AlertCircle, CheckCircle2, Loader2, Headphones, ArrowLeft } from "lucide-react";

type ForgotFormValues = z.infer<typeof forgotShema>;

export default function ForgotForm() {
    const router = useRouter();
    const [isSuccess, setIsSuccess] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotFormValues>({
        resolver: zodResolver(forgotShema),
    });

    const onSubmit = async (data: ForgotFormValues) => {
        try {
            setSubmitError(null);
            await apiClient.post("/auth/forgot-password", {
                email: data.email,
                redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
            });
            setIsSuccess(true);
            setTimeout(() => {
                router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
            }, 1000);
        } catch (error) {
            const message =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                typeof (error as any).response?.data?.message === "string"
                    ? (error as any).response.data.message
                    : "Không thể gửi yêu cầu. Vui lòng thử lại.";
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
                    <h1 className="text-2xl font-bold text-slate-900">Quên mật khẩu</h1>
                    <p className="text-slate-500 text-sm mt-1 text-center">Đừng lo, chúng tôi sẽ gửi mã đặt lại về email của bạn</p>
                </div>

                {isSuccess ? (
                    /* Success State */
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">Kiểm tra email của bạn</h2>
                        <p className="text-slate-500 text-sm mb-6">
                            Chúng tôi đã gửi mã đặt lại mật khẩu 6 số đến email bạn vừa nhập. Vui lòng nhập mã ở bước tiếp theo.
                        </p>
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 font-medium transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại Đăng nhập
                        </Link>
                    </div>
                ) : (
                    /* Form State */
                    <>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            {submitError && (
                                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <p>{submitError}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Email của bạn</label>
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

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl shadow-lg shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Gửi mã đặt lại mật khẩu"}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-500">
                            Nhớ ra mật khẩu rồi?{" "}
                            <Link href="/login" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
                                Đăng nhập
                            </Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}