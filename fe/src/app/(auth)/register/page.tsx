import RegisterForm from "@/components/auth/RegisterForm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("AuthMeta");

    return {
        title: t("registerTitle"),
        description: t("registerDescription"),
    };
}

export default function RegisterPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={null}>
                <RegisterForm/>
            </Suspense>
        </div>
    )
}