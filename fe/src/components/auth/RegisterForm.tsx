"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { registerSchema } from "@/lib/validation/auth";
import GoogleOAuthBtn from "./GoogleOAuthBtn";
import { apiClient } from "@/lib/api/api-client";
import { User, Mail, Lock, CheckCircle2, Loader2, AlertCircle, UserPlus } from "lucide-react";

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps = {}) {
  const t = useTranslations("RegisterForm");
  const tAuth = useTranslations("Auth");
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

      setSubmitSuccess(t("success"));
      
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000);
      } else {
        setTimeout(() => {
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        }, 1000);
      }
    } catch (error) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as any).response?.data?.message === "string"
          ? (error as any).response.data.message
          : t("submitFailed");
      setSubmitError(message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
            <UserPlus className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Tạo tài khoản mới</p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {submitError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{submitError}</p>
            </div>
          )}
          {submitSuccess && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p>{submitSuccess}</p>
            </div>
          )}
          
          {/* Trường Tên hiển thị */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 ml-1">{t("displayName")}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-indigo-500 transition-colors">
                <User className="w-5 h-5" />
              </div>
              <input
                {...register("displayName")}
                type="text"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                placeholder={t("displayNamePlaceholder")}
              />
            </div>
            {errors.displayName && <p className="text-red-500 text-sm mt-1 ml-1">{errors.displayName.message}</p>}
          </div>

          {/* Trường Email */}
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
                placeholder="nhap@email.com"
              />
            </div>
            {errors.email && <p className="text-red-500 text-sm mt-1 ml-1">{errors.email.message}</p>}
          </div>

          {/* Trường Mật khẩu */}
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
                placeholder={t("passwordPlaceholder")}
              />
            </div>
            {errors.password && <p className="text-red-500 text-sm mt-1 ml-1">{errors.password.message}</p>}
          </div>

          {/* Trường Xác nhận mật khẩu */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 ml-1">{t("confirmPassword")}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-indigo-500 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                {...register("confirmPassword")}
                type="password"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                placeholder={t("confirmPasswordPlaceholder")}
              />
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-sm mt-1 ml-1">{errors.confirmPassword.message}</p>}
          </div>

          {/* Checkbox điều khoản */}
          <div className="flex items-start pt-2">
            <div className="flex items-center h-5">
              <input 
                id="terms" 
                type="checkbox" 
                {...register("acceptTerms")} 
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer" 
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-gray-600 dark:text-gray-400 cursor-pointer">
                {t.rich("acceptTerms", {
                  terms: (chunks) => <Link href="/terms" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">{chunks}</Link>,
                })}
              </label>
              {errors.acceptTerms && <p className="text-red-500 text-sm mt-1">{errors.acceptTerms.message}</p>}
            </div>
          </div>

          {/* Nút Đăng ký */}
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
                <UserPlus className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
              </>
            )}
          </button>
        </form>

        {/* Dòng chữ Hoặc */}
        <div className="mt-6 flex items-center justify-center">
          <span className="h-px w-full bg-gray-200 dark:bg-gray-800"></span>
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap px-4">{tAuth("or")}</span>
          <span className="h-px w-full bg-gray-200 dark:bg-gray-800"></span>
        </div>

        {/* Nút đăng nhập Google */}
        <div className="mt-6">
          <GoogleOAuthBtn />
        </div>

        {/* Chuyển sang đăng nhập */}
        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          {t("hasAccount")}{" "}
          <Link 
            href={onSwitchToLogin ? "#" : "/login"}
            onClick={(e) => {
              if (onSwitchToLogin) {
                e.preventDefault();
                onSwitchToLogin();
              }
            }}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors"
          >
            {t("loginNow")}
          </Link>
        </p>
      </div>
    </div>
  );
}