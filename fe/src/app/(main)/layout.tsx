import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import GlobalPlayer from "@/components/player/GlobalPlayer";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {children}
      </main>
      <Footer />
      <GlobalPlayer />
    </div>
  );
}