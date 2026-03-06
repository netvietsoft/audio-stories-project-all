"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { resetByCodeSchema } from "@/lib/validation/auth";
import { apiClient } from "@/lib/api/api-client";

export default function ResetForm() {
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
          : "Đặt lại mật khẩu thất bại. Link có thể đã hết hạn.";
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

      setResendMessage("Đã gửi lại mã đặt lại mật khẩu. Vui lòng kiểm tra email.");
    } catch (error) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as any).response?.data?.message === "string"
          ? (error as any).response.data.message
          : "Không thể gửi lại mã. Vui lòng thử lại.";
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
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          {...register("email")}
          type="email"
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="nhap@email.com"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Mã đặt lại 6 số</label>
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
        <label className="block text-sm font-medium mb-1">Mật khẩu mới</label>
        <input
          {...register("password")}
          type="password"
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nhập mật khẩu mới"
        />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Xác nhận mật khẩu mới</label>
        <input
          {...register("confirmPassword")}
          type="password"
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Xác nhận mật khẩu mới"
        />
        {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Đang xử lý..." : "Đổi mật khẩu"}
      </button>

      <button
        type="button"
        onClick={onResendCode}
        disabled={isResending || !emailValue}
        className="w-full text-sm text-blue-600 hover:underline disabled:opacity-50"
      >
        {isResending ? "Đang gửi lại mã..." : "Gửi lại mã"}
      </button>
    </form>
  );
}