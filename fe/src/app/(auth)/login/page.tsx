import LoginForm from "@/components/auth/LoginForm";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Đăng nhập | Netviet Audio",
  description: "Đăng nhập vào tài khoản của bạn để trải nghiệm Netviet Audio với nhiều tính năng hấp dẫn.",
};


export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
