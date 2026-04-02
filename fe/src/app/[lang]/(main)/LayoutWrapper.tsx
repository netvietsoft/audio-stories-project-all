"use client";

import React from "react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {

    return (
        <main className="flex-1 w-full bg-white dark:bg-black">
            <div className="mx-auto w-full bg-white pb-24 px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw] pt-2 md:py-8 dark:bg-black">
                {children}
            </div>
        </main>
    );
}
