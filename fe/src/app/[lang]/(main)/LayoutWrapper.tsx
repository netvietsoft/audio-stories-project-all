"use client";

import React from "react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {

    return (
        <main
            className="flex-1 w-full bg-slate-50 pb-24 dark:bg-slate-950 mx-auto px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw] py-8"
        >
            {children}
        </main>
    );
}
