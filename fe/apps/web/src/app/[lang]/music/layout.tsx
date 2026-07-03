import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LayoutWrapper from "../(main)/LayoutWrapper";

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <LayoutWrapper>{children}</LayoutWrapper>
      <Footer />
    </div>
  );
}
