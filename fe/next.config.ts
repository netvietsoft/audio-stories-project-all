import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const envImagePatterns = [
  process.env.NEXT_PUBLIC_R2_URL,
  process.env.NEXT_PUBLIC_UPLOADTHING_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
]
  .filter(Boolean)
  .map((raw) => {
    try {
      const url = new URL(raw as string);
      return {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
      };
    } catch {
      return null;
    }
  })
  .filter((host): host is { protocol: "http" | "https"; hostname: string } => Boolean(host));

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "picsum.photos" },
      ...envImagePatterns,
    ],
  },
};

export default withPWA(nextConfig);
