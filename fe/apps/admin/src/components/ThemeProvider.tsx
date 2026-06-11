"use client"; // Bắt buộc vì next-themes sử dụng React Context (chỉ chạy ở Client)

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider ({
    children,
    ...props
} : React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider {...props}>
            {children}
        </NextThemesProvider>
    );
}