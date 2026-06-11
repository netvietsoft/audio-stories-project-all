import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LayoutWrapper from "./LayoutWrapper";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <LayoutWrapper>{children}</LayoutWrapper>
      <Footer />
    </div>
  );
}