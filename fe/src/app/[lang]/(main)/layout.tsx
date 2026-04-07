import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LayoutWrapper from "./LayoutWrapper";
import GlobalPlayerMount from "./GlobalPlayerMount";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <LayoutWrapper>{children}</LayoutWrapper>
      <Footer />
      <GlobalPlayerMount />
    </div>
  );
}