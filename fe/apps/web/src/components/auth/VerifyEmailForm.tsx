"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "@/components/shared/LocalizedLink";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { apiClient } from "@/lib/api/api-client";
import { setAuthCookies } from "@/lib/auth/cookies";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { useUserStore, type UserProfile } from "@/stores/user-store";
import { Mail, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import CodeInput from "./CodeInput";

type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

type VerifyCodeResponse = {
  ok: boolean;
  access_token: string;
};

type BackendMeResponse = {
  sub: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  roles?: string[];
  vip_tier?: number;
  credits?: number;
  pulse_balance?: number;
  premium_expires_at?: string | null;
};

const normalizeUserProfile = (profile: BackendMeResponse): UserProfile => ({
  id: profile.sub,
  email: profile.email,
  name: profile.name ?? undefined,
  avatarUrl: profile.avatar_url ?? undefined,
  roles: profile.roles ?? [],
  vipTier: profile.vip_tier,
  vipExpirationDate: profile.premium_expires_at,
  pulseBalance: profile.pulse_balance ?? profile.credits ?? 0,
});

interface VerifyEmailFormProps {
  token?: string;
  email?: string;
  onSuccess?: () => void;
}

export default function VerifyEmailForm({ token, email: emailProp, onSuccess }: VerifyEmailFormProps = {}) {
  const t = useTranslations("VerifyEmailForm");
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const currentLang = params?.lang === "en" ? "en" : "vi";
  const searchParams = useSearchParams();
  const emailFromQuery = useMemo(() => searchParams.get("email") || "", [searchParams]);
  const defaultEmail = emailProp || emailFromQuery;

  const setAuth = useUserStore((state) => state.setAuth);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: defaultEmail,
      code: "",
    },
  });

  const codeValue = watch("code");
  const emailValue = watch("email");

  const onSubmit = async (data: VerifyEmailValues) => {
    try {
      setSubmitError(null);
      setSubmitSuccess(null);

      const verifyResponse = await apiClient.post<VerifyCodeResponse>("/auth/verify-code", {
        email: data.email,
        code: data.code,
      });

      const { access_token } = verifyResponse.data;
      const profileResponse = await apiClient.get<BackendMeResponse>("/auth/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      setAuth({
        user: normalizeUserProfile(profileResponse.data),
        accessToken: access_token,
      });
      setAuthCookies(access_token);

      setSubmitSuccess(t("success"));

      // Reload page to update auth state
      setTimeout(() => {
        window.location.href = `/${currentLang}`;
      }, 1000);
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
      setResendError(null);
      setResendMessage(null);
      setIsResending(true);

      await apiClient.post("/auth/resend-code", {
        email: emailValue,
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
      setResendError(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1 text-center">
            {t("intro")}
          </p>
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
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">{t("codeDigits", { count: codeValue?.length || 0 })}</div>
            {errors.code && <p className="text-red-500 text-sm mt-1 text-center">{errors.code.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 dark:shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("verifying")}
              </>
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

          {resendMessage && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm text-center animate-in fade-in zoom-in duration-200">
              {resendMessage}
            </div>
          )}
          {resendError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm text-center animate-in fade-in zoom-in duration-200">
              {resendError}
            </div>
          )}
        </form>

        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          {t("backTo")}{" "}
          <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors">
            {t("login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
