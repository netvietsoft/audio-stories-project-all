"use client";

import { FcGoogle } from "react-icons/fc";

export default function GoogleOAuthBtn() {
  const handleGoogleOAuth = () => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
    window.location.href = `${apiBaseUrl}/auth/google`;
  }
  return (
    <button
        onClick={handleGoogleOAuth}
        type="button"
        className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none">
        <FcGoogle className="text-2xl" />
            Tiếp tục với Google
        </button>
  )};
