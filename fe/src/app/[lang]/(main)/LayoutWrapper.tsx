"use client";

import { usePathname } from "next/navigation";
import React from "react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isFullWidth = pathname === "/topup";

    return (
        <main
            className={`flex-1 w-full bg-slate-50 pb-24 dark:bg-slate-950 ${isFullWidth ? "" : "max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 2xl:px-14 py-8"
                }`}
        >
            {children}
        </main>
    );
}
