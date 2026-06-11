"use client";

import { FcGoogle } from "react-icons/fc";
import { useTranslations } from "next-intl";

export default function GoogleOAuthBtn() {
  const t = useTranslations("Auth");
  const handleGoogleOAuth = () => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    
    // Capture current URL to return after login
    // If we're on a login/register page, we should check for an existing redirect param or default to home
    const currentLoc = window.location;
    const searchParams = new URLSearchParams(currentLoc.search);
    const existingRedirect = searchParams.get("redirect");
    const isAuthPage = currentLoc.pathname.includes("/login") || currentLoc.pathname.includes("/register");
    
    // Only capture the path part to keep things internal
    const redirectUri = existingRedirect || (isAuthPage ? "/" : currentLoc.pathname + currentLoc.search);
    
    window.location.href = `${apiBaseUrl}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
  return (
    <button
        onClick={handleGoogleOAuth}
        type="button"
        className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none">
        <FcGoogle className="text-2xl" />
          {t("googleContinue")}
        </button>
  )};
