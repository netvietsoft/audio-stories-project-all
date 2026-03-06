import { Suspense } from "react";

import GoogleCallbackHandler from "@/components/auth/GoogleCallbackHandler";

export default function GoogleCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <Suspense fallback={<p className="text-sm text-gray-600 dark:text-gray-300">Đang xử lý...</p>}>
          <GoogleCallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}
