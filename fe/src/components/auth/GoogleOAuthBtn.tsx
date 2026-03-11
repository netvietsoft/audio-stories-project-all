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
            className="w-full flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all active:scale-[0.98]"
        >
            <FcGoogle className="text-xl" />
            Tiếp tục với Google
        </button>
    );
}
