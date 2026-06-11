import path from "node:path";
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
  transpilePackages: ["@audio-stories/shared", "@audio-stories/ui", "@audio-stories/api-client"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async redirects() {
    return [
      { source: "/:lang(vi|en)/new", destination: "/:lang/story/new", permanent: false },
      { source: "/:lang(vi|en)/trending", destination: "/:lang/story/trending", permanent: false },
      { source: "/:lang(vi|en)/interactive", destination: "/:lang/story/interactive", permanent: false },
      { source: "/:lang(vi|en)/ranking", destination: "/:lang/story/ranking", permanent: false },
      { source: "/:lang(vi|en)/vinh-danh", destination: "/:lang/story/vinh-danh", permanent: false },
      { source: "/:lang(vi|en)/stories", destination: "/:lang/story/stories", permanent: false },
      { source: "/:lang(vi|en)/stories/:slug", destination: "/:lang/story/stories/:slug", permanent: false },
      { source: "/:lang(vi|en)/categories/:slug", destination: "/:lang/story/categories/:slug", permanent: false },
      { source: "/:lang(vi|en)/search", destination: "/:lang/story/search", permanent: false },
      { source: "/:lang(vi|en)/explore", destination: "/:lang/story/explore", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "**.ufs.sh" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "khoinguonsangtao.vn" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "th.bing.com" },
      ...envImagePatterns,
    ],
  },
};

export default withNextIntl(withPWA(nextConfig));
