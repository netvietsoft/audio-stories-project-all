"use client";

import React from 'react';
import { CreditCard, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type PaymentMethod = 'vietqr' | 'stripe';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  excludeMethods?: PaymentMethod[];
}

export default function PaymentMethodSelector({ selected, onSelect, excludeMethods = [] }: PaymentMethodSelectorProps) {
  const t = useTranslations("Topup");
  
  const allMethods = [
    {
      id: 'vietqr' as PaymentMethod,
      name: 'VietQR',
      description: t('vietqrDescription'),
      icon: Wallet,
      badge: t('popular'),
    },
    {
      id: 'stripe' as PaymentMethod,
      name: t('internationalCard'),
      description: 'Visa, Mastercard, JCB',
      icon: CreditCard,
    },
  ];

  const methods = allMethods.filter(m => !excludeMethods.includes(m.id));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-300 mb-3">{t('selectPaymentMethod')}</h3>
      {methods.map((method) => {
        const Icon = method.icon;
        const isSelected = selected === method.id;

        return (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              isSelected
                ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isSelected ? 'bg-violet-600' : 'bg-slate-100 dark:bg-slate-800'
              }`}>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-400'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-slate-900 dark:text-white'}`}>{method.name}</span>
                  {method.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">
                      {method.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{method.description}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                isSelected ? 'border-violet-600' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {isSelected && (
                  <div className="w-3 h-3 rounded-full bg-violet-600" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
