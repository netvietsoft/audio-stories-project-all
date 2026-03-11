import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppProviders } from "@/providers/app-providers";

const inter = Inter({ subsets: ["vietnamese"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://netvietaudio.com";
const SITE_NAME = "Netviet Audio";
const SITE_DESCRIPTION =
    "Nền tảng nghe truyện audio chất lượng cao hàng đầu Việt Nam. Hàng nghìn cuốn truyện hay thuộc mọi thể loại: tiên hiệp, kiếm hiệp, ngôn tình, trinh thám, cổ đại... cập nhật mỗi ngày.";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    ],
};

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: SITE_NAME,
        template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
        "truyện audio",
        "nghe truyện",
        "truyện nói",
        "sách nói",
        "tiên hiệp audio",
        "kiếm hiệp audio",
        "ngôn tình audio",
        "trinh thám audio",
        "truyện full audio",
        "netviet audio",
        "audio truyện hay",
    ],

    // Authorship
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,

    // Canonical
    alternates: {
        canonical: "/",
        languages: {
            "vi-VN": "/",
        },
    },

    // Robots
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },

    // Open Graph
    openGraph: {
        type: "website",
        locale: "vi_VN",
        url: SITE_URL,
        siteName: SITE_NAME,
        title: SITE_NAME,
        description: SITE_DESCRIPTION,
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: `${SITE_NAME} - Nền tảng nghe truyện audio hàng đầu Việt Nam`,
            },
        ],
    },

    // Twitter/X
    twitter: {
        card: "summary_large_image",
        site: "@netvietaudio",
        creator: "@netvietaudio",
        title: SITE_NAME,
        description: SITE_DESCRIPTION,
        images: ["/og-image.png"],
    },

    // App / PWA related
    applicationName: SITE_NAME,
    category: "entertainment",
    classification: "Audio Entertainment",

    // Verification (fill in when ready)
    // verification: {
    //   google: "YOUR_GOOGLE_SITE_VERIFICATION_TOKEN",
    //   yandex: "YOUR_YANDEX_TOKEN",
    // },
};

// JSON-LD WebSite structured data
const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "vi-VN",
    potentialAction: {
        "@type": "SearchAction",
        target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/search?keyword={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
    },
};

const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
        "https://www.facebook.com/netvietaudio",
        "https://www.youtube.com/@netvietaudio",
        "https://twitter.com/netvietaudio",
    ],
    contactPoint: {
        "@type": "ContactPoint",
        email: "support@netvietaudio.com",
        contactType: "customer support",
        availableLanguage: "Vietnamese",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="vi" suppressHydrationWarning>
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
                />
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <link rel="manifest" href="/manifest.json" />
            </head>
            <body className={`${inter.className} min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
                <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
                    <AppProviders>{children}</AppProviders>
                </ThemeProvider>
            </body>
        </html>
    );
}