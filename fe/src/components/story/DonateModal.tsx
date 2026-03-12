"use client";

import { useState } from "react";
import { X, Gift, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { useUserStore } from "@/stores/user-store";

interface DonateModalProps {
  storyTitle: string;
  chapterNumber: number;
  currentCredits: number;
  onSuccess: (newBalance: number) => void;
  onClose: () => void;
}

export default function DonateModal({
  storyTitle,
  chapterNumber,
  currentCredits,
  onSuccess,
  onClose,
}: DonateModalProps) {
  const [amount, setAmount] = useState<string>("10");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const donationAmount = parseInt(amount);

    if (isNaN(donationAmount) || donationAmount <= 0) {
      setError("Vui lòng nhập số credit hợp lệ.");
      return;
    }

    if (donationAmount > currentCredits) {
      setError("Bạn không đủ credit để tặng số lượng này.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.post("/transactions/donate", {
        amount: donationAmount,
        description: `Tặng ${donationAmount} credits cho chương ${chapterNumber} của truyện ${storyTitle}`,
      });

      if (response.data.success) {
        onSuccess(response.data.newBalance);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-200 rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            <Gift className="h-5 w-5 text-pink-500" />
            Tặng quà cho chương
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bạn đang tặng quà cho <b>Chương {chapterNumber}</b> của truyện <b>{storyTitle}</b>
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Số credit muốn tặng
              </label>
              <div className="relative">
                <input
                  type="type"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-lg font-bold text-gray-900 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="Nhập số lượng..."
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-gray-500">
                  Credits
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-pink-50/50 p-4 dark:bg-pink-900/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Số dư hiện tại:</span>
                <span className="font-bold text-pink-600 dark:text-pink-400">
                  {currentCredits.toLocaleString("vi-VN")} Credits
                </span>
              </div>
            </div>

            {error && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-600/20 transition hover:bg-pink-700 active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>Tặng ngay</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
