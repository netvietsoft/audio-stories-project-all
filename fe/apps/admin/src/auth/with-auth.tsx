"use client";

import { useEffect, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AUTH_LOGIN_PATH } from "@/constants/auth";
import { useAuth } from "@/auth/use-auth";

export const withAuth = <P extends object>(Component: ComponentType<P>) => {
  const WithAuthComponent = (props: P) => {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
        router.replace(`${AUTH_LOGIN_PATH}${redirect}`);
      }
    }, [isAuthenticated, isLoading, pathname, router]);

    if (isLoading || !isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };

  WithAuthComponent.displayName = `WithAuth(${Component.displayName ?? Component.name ?? "Component"})`;

  return WithAuthComponent;
};
