import VerifyEmailForm from "@/components/auth/VerifyEmailForm";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
	title: "Xác minh email | Netviet Audio",
	description: "Nhập mã xác thực 6 số để kích hoạt tài khoản.",
};


export default function VerifyEmailPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
			<Suspense fallback={null}>
				<VerifyEmailForm />
			</Suspense>
		</div>
	);
}

