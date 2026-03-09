"use client";

import React from 'react';
import { CreditCard, Wallet, DollarSign } from 'lucide-react';

export type PaymentMethod = 'vietqr' | 'stripe' | 'paypal';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

export default function PaymentMethodSelector({ selected, onSelect }: PaymentMethodSelectorProps) {
  const methods = [
    {
      id: 'vietqr' as PaymentMethod,
      name: 'VietQR',
      description: 'Chuyển khoản ngân hàng',
      icon: Wallet,
      badge: 'Phổ biến',
    },
    {
      id: 'stripe' as PaymentMethod,
      name: 'Thẻ quốc tế',
      description: 'Visa, Mastercard',
      icon: CreditCard,
    },
    {
      id: 'paypal' as PaymentMethod,
      name: 'PayPal',
      description: 'Thanh toán PayPal',
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-900 mb-3">Chọn phương thức thanh toán</h3>
      {methods.map((method) => {
        const Icon = method.icon;
        const isSelected = selected === method.id;

        return (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              isSelected
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isSelected ? 'bg-slate-900' : 'bg-slate-100'
              }`}>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-slate-700'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{method.name}</span>
                  {method.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                      {method.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{method.description}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                isSelected ? 'border-slate-900' : 'border-slate-300'
              }`}>
                {isSelected && (
                  <div className="w-3 h-3 rounded-full bg-slate-900" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
