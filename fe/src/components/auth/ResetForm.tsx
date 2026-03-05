"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { resetSchema } from "@/lib/validation/auth"; // Đảm bảo đã có file này với schema reset password
import { apiClient } from "@/lib/api/api-client";

export default function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token"); // Bắt token từ URL
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: z.infer<typeof resetSchema>) => {
    if (!token) {
      alert("Link đổi mật khẩu không hợp lệ hoặc đã hết hạn!");
      return;
    }
    try {
      setSubmitError(null);
      await apiClient.post("/auth/reset-password", {
        token,
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

  if (!token) {
    return <div className="text-center text-red-500">Token không hợp lệ. Vui lòng kiểm tra lại email.</div>;
  }

  return (
    // ... UI Form bao gồm input password, confirmPassword và nút "Đổi mật khẩu" ...
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {submitError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
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
    </form>
  );
}