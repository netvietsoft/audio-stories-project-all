"use client";

import { useEffect } from 'react';
import { CheckCircle, ArrowRight, Coins } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TopupSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Refresh user data or credits
    // You can call an API here to get updated user info
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-8 text-center">
          {/* Success Icon */}
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-16 h-16 text-emerald-600" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-black text-slate-900 mb-3">
            Thanh toán thành công!
          </h1>

          {/* Description */}
          <p className="text-slate-600 mb-8">
            Credits đã được nạp vào tài khoản của bạn. Bạn có thể bắt đầu sử dụng ngay bây giờ.
          </p>

          {/* Stats */}
          <div className="bg-slate-50 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins className="w-6 h-6 text-emerald-500" />
              <span className="text-sm text-slate-600 font-medium">Credits của bạn</span>
            </div>
            <p className="text-4xl font-black text-slate-900">
              {/* This should be fetched from API */}
              ---
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/')}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Về trang chủ
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => router.push('/topup')}
              className="w-full py-4 border-2 border-slate-200 text-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Nạp thêm credits
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi! 🎉
          </p>
        </div>
      </div>
    </div>
  );
}
