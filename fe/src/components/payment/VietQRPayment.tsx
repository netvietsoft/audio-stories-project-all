"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Clock, Copy, Check } from 'lucide-react';

interface VietQRPaymentProps {
  orderId: string;
  qrImage: string;
  amount: number;
  transactionCode: string;
  bankInfo: {
    bank_id: string;
    account_no: string;
    account_name: string;
  };
  expiresAt: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VietQRPayment({
  orderId,
  qrImage,
  amount,
  transactionCode,
  bankInfo,
  expiresAt,
  onSuccess,
  onCancel,
}: VietQRPaymentProps) {
  const [status, setStatus] = useState<'pending' | 'checking' | 'success' | 'expired'>('pending');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setStatus('expired');
        clearInterval(interval);
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-12 h-12 text-emerald-600" />
        </div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">Thanh toán thành công!</h3>
        <p className="text-slate-600 mb-6">Credits đã được nạp vào tài khoản của bạn</p>
        <button
          onClick={onSuccess}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800"
        >
          Hoàn tất
        </button>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-12 h-12 text-red-600" />
        </div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">Đã hết hạn</h3>
        <p className="text-slate-600 mb-6">Mã QR đã hết hạn. Vui lòng tạo đơn hàng mới.</p>
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <Clock className="w-5 h-5 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">Thời gian còn lại</p>
          <p className="text-2xl font-black text-amber-600">{formatTime(timeLeft)}</p>
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-black text-slate-900 mb-1">Quét mã QR để thanh toán</h3>
          <p className="text-sm text-slate-500">Sử dụng app ngân hàng để quét mã</p>
        </div>
        
        {qrImage && (
          <div className="flex justify-center mb-4">
            <div className="relative w-64 h-64 bg-white rounded-xl border-2 border-slate-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImage}
                alt="QR Code"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Số tiền</span>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900">{formatCurrency(amount)}</span>
              <button
                onClick={() => copyToClipboard(amount.toString(), 'amount')}
                className="p-1 hover:bg-slate-200 rounded"
              >
                {copied === 'amount' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Nội dung CK</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900">{transactionCode}</span>
              <button
                onClick={() => copyToClipboard(transactionCode, 'code')}
                className="p-1 hover:bg-slate-200 rounded"
              >
                {copied === 'code' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Số tài khoản</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900">{bankInfo.account_no}</span>
              <button
                onClick={() => copyToClipboard(bankInfo.account_no, 'account')}
                className="p-1 hover:bg-slate-200 rounded"
              >
                {copied === 'account' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Chủ tài khoản</span>
            <span className="font-bold text-slate-900">{bankInfo.account_name}</span>
          </div>
        </div>
      </div>

      {/* Status */}
      {status === 'checking' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <p className="text-sm font-bold text-blue-900">Đang kiểm tra thanh toán...</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 border-2 border-slate-200 text-slate-900 rounded-xl font-bold hover:bg-slate-50"
        >
          Huỷ
        </button>
        <button
          onClick={() => {
            setStatus('checking');
            // TODO: Check payment status
            setTimeout(() => {
              // Simulate success
              setStatus('success');
              onSuccess();
            }, 2000);
          }}
          className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800"
        >
          Tôi đã chuyển khoản
        </button>
      </div>

      <p className="text-xs text-center text-slate-500">
        Sau khi chuyển khoản, hệ thống sẽ tự động xác nhận trong vòng 1-2 phút
      </p>
    </div>
  );
}
