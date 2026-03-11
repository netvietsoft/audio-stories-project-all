"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { registerSchema } from "@/lib/validation/auth"; // Đảm bảo đã có file này với schema đăng ký
import GoogleOAuthBtn from "./GoogleOAuthBtn"; // Đảm bảo đã có file này cùng thư mục
import { apiClient } from "@/lib/api/api-client";

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
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
          : t("submitFailed");
      setSubmitError(message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {submitError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
        {submitSuccess && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{submitSuccess}</p>}
        
        {/* Trường Tên hiển thị */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("displayName")}</label>
          <input
            {...register("displayName")}
            type="text"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t("displayNamePlaceholder")}
          />
          {errors.displayName && <p className="text-red-500 text-sm mt-1">{errors.displayName.message}</p>}
        </div>

        {/* Trường Email */}
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

        {/* Trường Mật khẩu */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("password")}</label>
          <input
            {...register("password")}
            type="password"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t("passwordPlaceholder")}
          />
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
        </div>

        {/* Trường Xác nhận mật khẩu */}
        <div>
          <label className="block text-sm font-medium mb-1">{t("confirmPassword")}</label>
          <input
            {...register("confirmPassword")}
            type="password"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t("confirmPasswordPlaceholder")}
          />
          {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>}
        </div>

        {/* Checkbox điều khoản */}
        <div className="flex items-start pt-2">
          <div className="flex items-center h-5">
            <input 
              id="terms" 
              type="checkbox" 
              {...register("acceptTerms")} 
              className="w-4 h-4 text-blue-600 bg-gray-100 rounded border-gray-300 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" 
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="terms" className="text-gray-600 dark:text-gray-300">
              {t.rich("acceptTerms", {
                terms: (chunks) => <Link href="/terms" className="text-blue-600 hover:underline">{chunks}</Link>,
              })}
            </label>
            {errors.acceptTerms && <p className="text-red-500 text-sm mt-1">{errors.acceptTerms.message}</p>}
          </div>
        </div>

        {/* Nút Đăng ký */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? tAuth("processing") : t("submit")}
        </button>
      </form>

      {/* Dòng chữ Hoặc */}
      <div className="mt-6 flex items-center justify-center space-x-2">
        <span className="h-px w-full bg-gray-200 dark:bg-gray-700"></span>
        <span className="text-sm text-gray-500 whitespace-nowrap">{tAuth("or")}</span>
        <span className="h-px w-full bg-gray-200 dark:bg-gray-700"></span>
      </div>

      {/* Nút đăng nhập Google */}
      <div className="mt-4">
        <GoogleOAuthBtn />
      </div>

      {/* Chuyển sang đăng nhập */}
      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">
          {t("loginNow")}
        </Link>
      </p>
    </div>
  );
}