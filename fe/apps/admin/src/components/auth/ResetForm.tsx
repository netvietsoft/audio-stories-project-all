"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { resetByCodeSchema } from "@/lib/validation/auth";
import { apiClient } from "@/lib/api/api-client";
import { Mail, Lock, Loader2, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import CodeInput from "./CodeInput";
import { useAuthModalStore } from "@/stores/auth-modal-store";

interface ResetFormProps {
  token?: string;
  email?: string;
  onSuccess?: () => void;
}

export default function ResetForm({ token, email: emailProp, onSuccess }: ResetFormProps = {}) {
  const t = useTranslations("ResetForm");
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const { setView } = useAuthModalStore();
  const emailFromQuery = searchParams.get("email") || "";
  const defaultEmail = emailProp || emailFromQuery;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetByCodeSchema>>({
    resolver: zodResolver(resetByCodeSchema),
    defaultValues: {
      email: defaultEmail,
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  const emailValue = watch("email");
  const codeValue = watch("code");

  const onSubmit = async (data: z.infer<typeof resetByCodeSchema>) => {
    try {
      setSubmitError(null);
      await apiClient.post("/auth/reset-password", {
        email: data.email,
        code: data.code,
        newPassword: data.password,
      });
      
      // If onSuccess is provided (modal context), call it
      if (onSuccess) {
        onSuccess();
      } else {
        // Otherwise switch to login view in modal or redirect
        if (emailProp) {
          setView('login');
        } else {
          router.push(`/${currentLang}/login?reset=1`);
        }
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

  const onResendCode = async () => {
    try {
      setSubmitError(null);
      setResendMessage(null);
      setIsResending(true);

      await apiClient.post("/auth/forgot-password", {
        email: emailValue,
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
      });

      setResendMessage(t("resendSuccess"));
    } catch (error) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as any).response?.data?.message === "string"
          ? (error as any).response.data.message
          : t("resendFailed");
      setSubmitError(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Đặt lại mật khẩu</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Nhập mã và mật khẩu mới</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {submitError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{submitError}</p>
            </div>
          )}
          {resendMessage && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p>{resendMessage}</p>
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
                placeholder="nhap@email.com"
              />
            </div>
            {errors.email && <p className="text-red-500 text-sm mt-1 ml-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 ml-1">{t("code")}</label>
            <CodeInput
              value={codeValue || ""}
              onChange={(value) => setValue("code", value)}
              disabled={isSubmitting}
            />
            {errors.code && <p className="text-red-500 text-sm mt-1 text-center">{errors.code.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 ml-1">{t("newPassword")}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-indigo-500 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                {...register("password")}
                type="password"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                placeholder={t("newPasswordPlaceholder")}
              />
            </div>
            {errors.password && <p className="text-red-500 text-sm mt-1 ml-1">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 ml-1">{t("confirmNewPassword")}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-gray-500 group-focus-within:text-indigo-500 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                {...register("confirmPassword")}
                type="password"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500"
                placeholder={t("confirmNewPasswordPlaceholder")}
              />
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-sm mt-1 ml-1">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 dark:shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t("submit")
            )}
          </button>

          <button
            type="button"
            onClick={onResendCode}
            disabled={isResending || !emailValue}
            className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? t("resending") : t("resend")}
          </button>
        </form>
      </div>
    </div>
  );
}
