import RegisterForm from "@/components/auth/RegisterForm";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản | Netviet Audio",
  description: "Tạo tài khoản mới để trải nghiệm Netviet Audio với nhiều tính năng hấp dẫn.",
};


export default function RegisterPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={null}>
                <RegisterForm/>
            </Suspense>
        </div>
    )
}