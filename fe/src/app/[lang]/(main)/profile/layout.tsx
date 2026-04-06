import type { ReactNode } from "react";

import ProfileSidebar from "@/components/profile/ProfileSidebar";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full bg-white py-4 dark:bg-[#161616] sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 md:flex-row">
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
