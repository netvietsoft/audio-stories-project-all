"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { apiClient } from "@/lib/api/api-client";
import { setAuthCookies } from "@/lib/auth/cookies";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { useUserStore, type UserProfile } from "@/stores/user-store";

type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

type VerifyCodeResponse = {
  ok: boolean;
  access_token: string;
  refresh_token: string;
};

type BackendMeResponse = {
  sub: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  roles?: string[];
  vip_tier?: number;
  credits?: number;
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
  credits: profile.credits ?? 0,
});

export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = useMemo(() => searchParams.get("email") || "", [searchParams]);

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
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: emailFromQuery,
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

      const { access_token, refresh_token } = verifyResponse.data;
      const profileResponse = await apiClient.get<BackendMeResponse>("/auth/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      setAuth({
        user: normalizeUserProfile(profileResponse.data),
        accessToken: access_token,
        refreshToken: refresh_token,
      });
      setAuthCookies(access_token, refresh_token);

      setSubmitSuccess("Xác minh email thành công. Đang chuyển trang...");
      router.replace("/");
    } catch (error) {
      const message =
        typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as any).response?.data?.message === "string"
          ? (error as any).response.data.message
          : "Xác minh thất bại. Vui lòng kiểm tra lại mã và thử lại.";
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

      setResendMessage("Đã gửi lại mã xác thực. Vui lòng kiểm tra email.");
    } catch (error) {
      const message =
        typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as any).response?.data?.message === "string"
          ? (error as any).response.data.message
          : "Không thể gửi lại mã. Vui lòng thử lại.";
      setResendError(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h2 className="text-2xl font-bold text-center mb-2">Xác minh email</h2>
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
        Nhập mã xác thực 6 số đã được gửi về email của bạn.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {submitError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
        {submitSuccess && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{submitSuccess}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            {...register("email")}
            type="email"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            placeholder="nhap@email.com"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Mã xác thực 6 số</label>
          <input
            {...register("code")}
            type="text"
            inputMode="numeric"
            maxLength={6}
            className="w-full px-3 py-2 border rounded-md text-center text-2xl tracking-[0.5em] font-semibold dark:bg-gray-700 dark:border-gray-600"
            placeholder="000000"
            onInput={(event) => {
              const target = event.target as HTMLInputElement;
              target.value = target.value.replace(/\D/g, "").slice(0, 6);
            }}
          />
          <div className="mt-1 text-xs text-gray-500">{codeValue?.length || 0}/6 chữ số</div>
          {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Đang xác minh..." : "Xác minh email"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onResendCode}
          disabled={isResending || !emailValue}
          className="text-sm text-blue-600 hover:underline disabled:opacity-50"
        >
          {isResending ? "Đang gửi lại mã..." : "Gửi lại mã"}
        </button>
      </div>

      {resendMessage && <p className="mt-3 text-sm text-green-700 text-center">{resendMessage}</p>}
      {resendError && <p className="mt-3 text-sm text-red-600 text-center">{resendError}</p>}

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        Quay lại <Link href="/login" className="text-blue-600 hover:underline font-medium">Đăng nhập</Link>
      </p>
    </div>
  );
}
