import type { ReactNode } from "react";

import ProfileSidebar from "@/components/profile/ProfileSidebar";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full bg-white py-0 dark:bg-[#161616] sm:py-6">
      <div className="flex w-full flex-col gap-4 px-0 md:mx-auto md:max-w-6xl md:gap-6 md:px-4 md:flex-row">
        <aside className="w-full shrink-0 md:w-64">
          <div className="lg:sticky lg:top-24">
            <ProfileSidebar />
          </div>
        </aside>
        <main className="relative min-h-[70vh] min-w-0 flex-1 overflow-y-auto no-scrollbar">{children}</main>
      </div>
    </div>
  );
}
