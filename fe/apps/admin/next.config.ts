import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
      { source: "/admin", destination: "/vi", permanent: false },
      { source: "/:lang(vi|en)/admin", destination: "/:lang", permanent: false },
      { source: "/:lang(vi|en)/admin/login", destination: "/:lang/login", permanent: false },
      { source: "/:lang(vi|en)/admin/:path*", destination: "/:lang/:path*", permanent: false },
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

export default withNextIntl(nextConfig);
