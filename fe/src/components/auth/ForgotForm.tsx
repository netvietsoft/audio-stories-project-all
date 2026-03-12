"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { forgotShema } from "@/lib/validation/auth"; 
import Link from "next/link";
import { apiClient } from "@/lib/api/api-client";
import { Mail, Loader2, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

type ForgotFormValues = z.infer<typeof forgotShema>;

interface ForgotFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export default function ForgotForm({ onSuccess, onSwitchToLogin }: ForgotFormProps = {}) {
  const t = useTranslations("ForgotForm");
  const tAuth = useTranslations("Auth");
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
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000);
      } else {
        setTimeout(() => {
          router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
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
      <div className="bg-white dark:bg-gray-900 rounded-[32px] shadow-xl shadow-slate-200/50 dark:shadow-gray-950/50 border border-slate-200 dark:border-gray-800 p-8 md:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1 text-center">
            {isSuccess ? t("successTitle") : t("intro")}
          </p>
        </div>

        {isSuccess ? (
          <div className="text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">
              {t("successMessage")}
            </p>
            <Link 
              href="/" 
              onClick={(e) => {
                if (onSwitchToLogin) {
                  e.preventDefault();
                  onSwitchToLogin();
                }
              }}
              className="w-full inline-block py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-900 dark:text-white rounded-2xl font-semibold transition-all active:scale-[0.98]"
            >
              {t("backToLogin")}
            </Link>
          </div>
        ) : (
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
                  placeholder="nhap@email.com"
                />
              </div>
              {errors.email && <p className="text-red-500 text-sm mt-1 ml-1">{errors.email.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 dark:shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("sending")}
                </>
              ) : (
                t("sendCode")
              )}
            </button>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              {t("remembered")}{" "}
              <Link 
                href={onSwitchToLogin ? "#" : "/"}
                onClick={(e) => {
                  if (onSwitchToLogin) {
                    e.preventDefault();
                    onSwitchToLogin();
                  }
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors"
              >
                {t("login")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

