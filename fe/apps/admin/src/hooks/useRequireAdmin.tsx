"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ADMIN_ACCESS_TOKEN_KEY } from '@/lib/api/admin-api-client';
import { useAdminStore } from '@/stores/admin-store';

export default function useRequireAdmin(autoRedirect = false) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const check = () => {
      const storeUser = useAdminStore.getState().user;
      const localFlag = typeof window !== 'undefined' && localStorage.getItem('adminLoggedIn') === 'true';
      const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY) : null;
      const hasAdmin = !!storeUser || !!localFlag || !!token;

      setIsAdmin(hasAdmin);
      setIsLoading(false);

      if (!hasAdmin && autoRedirect) {
        const locale = pathname?.split('/')[1] || 'vi';
        router.replace(`/${locale}/login`);
      }
    };

    check();
  }, [autoRedirect, pathname, router]);

  const ensureRedirect = () => {
    if (!isAdmin) {
      const locale = pathname?.split('/')[1] || 'vi';
      router.replace(`/${locale}/login`);
    }
  };

  return { isAdmin, isLoading, ensureRedirect };
}
