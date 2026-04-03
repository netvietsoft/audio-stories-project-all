"use client";

import React from "react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {

    return (
        <main className="app-root-surface flex-1 w-full">
            <div className="mx-auto w-full pb-32 px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw] pt-2 md:py-8">
                {children}
            </div>
        </main>
    );
}
