"use client";

import dynamic from "next/dynamic";
import { type PropsWithChildren } from "react";

const GlobalPlayer = dynamic(() => import("@/components/player/GlobalPlayer"), {
  ssr: false,
});

export function AudioProvider({ children }: PropsWithChildren) {
  return (
    <>
      {children}
      <GlobalPlayer />
    </>
  );
}
