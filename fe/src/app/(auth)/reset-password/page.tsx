import ResetForm from "@/components/auth/ResetForm";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu | Web Truyện Audio",
  description: "Đặt lại mật khẩu của bạn để tiếp tục trải nghiệm Web Truyện Audio với nhiều tính năng hấp dẫn.",
};

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={null}>
                <ResetForm/>
            </Suspense>
        </div>
    );
}