"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { forgotShema } from "@/lib/validation/auth"; 
import Link from "next/link";
import { apiClient } from "@/lib/api/api-client";

type ForgotFormValues = z.infer<typeof forgotShema>;

export default function ForgotForm() {
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
        <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
            <h2 className="text-2xl font-bold text-center mb-2">Quên mật khẩu</h2>
            { /* trạng thái 1: gửi thành công -> hiện thông báo*/}
            {isSuccess ? (
                <div className="text-center mt-6">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Kiểm tra email của bạn</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                        Chúng tôi đã gửi một đường dẫn đặt lại mật khẩu đến email bạn vừa nhập. Vui lòng kiểm tra cả hộp thư rác (Spam).
                    </p>
                    <Link 
                        href="/login" 
                        className="w-full inline-block py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 rounded-md font-medium transition-colors"
                    >
                        Quay lại Đăng nhập
                    </Link>
                </div>
            ) : (
                /* TRẠNG THÁI 2: Chưa gửi -> Hiển thị form nhập email */
                <>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Đừng lo lắng! Hãy nhập email bạn đã đăng ký, chúng tôi sẽ gửi cho bạn đường dẫn để đặt lại mật khẩu.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {submitError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
            <div>
              <label className="block text-sm font-medium mb-1">Email của bạn</label>
              <input
                {...register("email")}
                type="email"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="nhap@email.com"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {isSubmitting ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              {isSubmitting ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Nhớ ra mật khẩu rồi?{" "}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Đăng nhập
            </Link>
          </p>
        </>
            )}
        </div>
    );
}