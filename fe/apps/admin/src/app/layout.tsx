import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import CustomHeadScripts from "@/components/CustomHeadScripts";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${beVietnamPro.className} antialiased min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-300`}>
        <CustomHeadScripts />
        {children}
      </body>
    </html>
  );
}
