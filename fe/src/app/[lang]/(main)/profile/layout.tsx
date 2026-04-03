import type { ReactNode } from "react";

import ProfileSidebar from "@/components/profile/ProfileSidebar";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="lg:sticky lg:top-24">
            <ProfileSidebar />
          </div>
        </div>
        <div className="lg:col-span-8 xl:col-span-9">{children}</div>
      </div>
    </div>
  );
}
