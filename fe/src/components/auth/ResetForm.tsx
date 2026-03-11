"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { resetByCodeSchema } from "@/lib/validation/auth";
import { apiClient } from "@/lib/api/api-client";

export default function ResetForm() {
  const t = useTranslations("ResetForm");
  const tAuth = useTranslations("Auth");
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailFromQuery = searchParams.get("email") || "";
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetByCodeSchema>>({
    resolver: zodResolver(resetByCodeSchema),
    defaultValues: {
      email: emailFromQuery,
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  const emailValue = watch("email");

  const onSubmit = async (data: z.infer<typeof resetByCodeSchema>) => {
    try {
      setSubmitError(null);
      await apiClient.post("/auth/reset-password", {
        email: data.email,
        code: data.code,
        newPassword: data.password,
      });
      router.push("/login?reset=1");
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {submitError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
      {resendMessage && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{resendMessage}</p>}
      <div>
        <label className="block text-sm font-medium mb-1">{t("email")}</label>
        <input
          {...register("email")}
          type="email"
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="nhap@email.com"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("code")}</label>
        <input
          {...register("code")}
          type="text"
          inputMode="numeric"
          maxLength={6}
          className="w-full px-3 py-2 border rounded-md text-center text-2xl tracking-[0.5em] font-semibold dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="000000"
          onInput={(event) => {
            const target = event.target as HTMLInputElement;
            target.value = target.value.replace(/\D/g, "").slice(0, 6);
          }}
        />
        {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("newPassword")}</label>
        <input
          {...register("password")}
          type="password"
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t("newPasswordPlaceholder")}
        />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("confirmNewPassword")}</label>
        <input
          {...register("confirmPassword")}
          type="password"
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t("confirmNewPasswordPlaceholder")}
        />
        {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? tAuth("processing") : t("submit")}
      </button>

      <button
        type="button"
        onClick={onResendCode}
        disabled={isResending || !emailValue}
        className="w-full text-sm text-blue-600 hover:underline disabled:opacity-50"
      >
        {isResending ? t("resending") : t("resend")}
      </button>
    </form>
  );
}