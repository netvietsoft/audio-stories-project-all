import LoginForm from "@/components/auth/LoginForm";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Đăng nhập | Web Truyện Audio",
  description: "Đăng nhập vào tài khoản của bạn để trải nghiệm Web Truyện Audio với nhiều tính năng hấp dẫn.",
};

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={null}>
                <LoginForm/>
            </Suspense>
        </div>
    )
}