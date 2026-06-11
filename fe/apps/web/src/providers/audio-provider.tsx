"use client";

import dynamic from "next/dynamic";
import { type PropsWithChildren } from "react";
import { usePathname } from "next/navigation";

const GlobalPlayer = dynamic(() => import("@/components/player/GlobalPlayer"), {
  ssr: false,
});

export function AudioProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isAdmin = pathname?.includes("/admin");

  return (
    <>
      {children}
      {!isAdmin && <GlobalPlayer />}
    </>
  );
}
