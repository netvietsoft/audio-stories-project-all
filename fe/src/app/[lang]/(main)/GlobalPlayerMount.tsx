"use client";

import dynamic from "next/dynamic";

const GlobalPlayer = dynamic(() => import("@/components/player/GlobalPlayer"), {
  ssr: false,
});

export default function GlobalPlayerMount() {
  return <GlobalPlayer />;
}
