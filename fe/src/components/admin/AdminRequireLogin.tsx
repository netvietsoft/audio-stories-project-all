"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import useRequireAdmin from '@/hooks/useRequireAdmin';

export default function AdminRequireLogin() {
  // Trigger redirect via hook (will replace current route to admin login)
  useRequireAdmin(true);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );
}
