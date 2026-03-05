import ForgotForm from "@/components/auth/ForgotForm";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Quên mật khẩu | Web Truyện Audio",
  description: "Khôi phục mật khẩu của bạn để tiếp tục trải nghiệm Web Truyện Audio với nhiều tính năng hấp dẫn.",
};

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={null}>
                <ForgotForm/>
            </Suspense>
        </div>
    );
}