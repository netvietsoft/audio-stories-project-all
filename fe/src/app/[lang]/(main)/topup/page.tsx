"use client";

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
    Coins,
    Loader2,
    Sparkles,
    Check,
    CreditCard,
    Wallet,
    ArrowRight,
    Gift,
    Zap,
} from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector';
import type { PaymentMethod } from '@/components/payment/PaymentMethodSelector';
import VietQRPayment from '@/components/payment/VietQRPayment';

interface PaymentPackage {
    code: string;
    name: string;
    priceVnd: number;
    price?: number;
    currency?: string;
    lang?: string;
    credits: number;
    description?: string;
    isActive: boolean;
    displayOrder: number;
}

export default function TopupPage() {
    const t = useTranslations("Topup");
    const locale = useLocale();
    const [packages, setPackages] = useState<PaymentPackage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPackage, setSelectedPackage] = useState<PaymentPackage | null>(null);
    const [customAmount, setCustomAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('vietqr');
    const [isProcessing, setIsProcessing] = useState(false);
    const [vietqrData, setVietqrData] = useState<any>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get(`/packages?lang=${locale}`);
            const activePackages = res.data
                .filter((pkg: PaymentPackage) => pkg.isActive)
                .sort((a: PaymentPackage, b: PaymentPackage) => a.displayOrder - b.displayOrder);
            setPackages(activePackages);

            // Auto-select first package if none selected
            if (activePackages.length > 0 && !selectedPackage) {
                handleSelectPackage(activePackages[0]);
            }
        } catch (error) {
            console.error('Failed to fetch packages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount: number, currency = 'VND') => {
        return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    const handleSelectPackage = (pkg: PaymentPackage) => {
        setSelectedPackage(pkg);
        // If the package is not VND, automatically switch to stripe if current was vietqr
        if (pkg.currency && pkg.currency !== 'VND' && paymentMethod === 'vietqr') {
            setPaymentMethod('stripe');
        }
    };

    const handleCheckout = async () => {
        if (!selectedPackage) return;
        if (selectedPackage.code === 'CUSTOM' && customAmount < 6000) return;

        setIsProcessing(true);

        try {
            if (paymentMethod === 'vietqr') {
                const res = await apiClient.post('/billing/vietqr/create-order', {
                    package_code: selectedPackage.code,
                });
                setVietqrData(res.data);
                setShowPaymentModal(true);
            } else if (paymentMethod === 'stripe') {
                const res = await apiClient.post('/billing/create-checkout-session', {
                    package_code: selectedPackage.code,
                    provider: 'STRIPE',
                    success_url: `${window.location.origin}/${locale}/topup/success`,
                    cancel_url: `${window.location.origin}/${locale}/topup`,
                });
                if (res.data.url) {
                    window.location.href = res.data.url;
                }
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            const errorMessage = error?.response?.data?.message || error?.message || (locale === 'vi' ? 'Có lỗi xảy ra. Vui lòng thử lại.' : 'An error occurred. Please try again.');
            alert(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex m-auto mt-60 justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600 dark:text-violet-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen font-sans">

            {/* Main Content Area */}
            <div className="px-4 sm:px-6 mt-24 lg:px-8 py-8 sm:py-12 -mt-6 sm:-mt-8 relative z-20">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-7xl mx-auto">

                    {/* Left Side: Packages */}
                    <div className="w-full lg:w-[70%]">
                        <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-[2rem] p-2 sm:p-4 shadow-xl shadow-slate-200/50 dark:shadow-none border border-white dark:border-slate-700/50 mb-6 sm:mb-8">
                            {packages.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                                    {packages.map((pkg) => {
                                        // Determine badges based on displayOrder and credits
                                        const sortedByDisplayOrder = [...packages].sort((a, b) => a.displayOrder - b.displayOrder);
                                        const sortedByCredits = [...packages].sort((a, b) => b.credits - a.credits);

                                        // Popular package: middle displayOrder
                                        const middleIndex = Math.floor(sortedByDisplayOrder.length / 2);
                                        const popularPackage = sortedByDisplayOrder[middleIndex];
                                        const isPopular = popularPackage ? pkg.code === popularPackage.code : false;

                                        // Best value package: highest credits
                                        const bestValuePackage = sortedByCredits[0];
                                        const isBestValue = bestValuePackage ? pkg.code === bestValuePackage.code : false;

                                        const isSelected = selectedPackage?.code === pkg.code;

                                        return (
                                            <div
                                                key={pkg.code}
                                                className={`relative bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border-2 transition-all duration-300 cursor-pointer flex flex-col group ${isSelected
                                                    ? 'border-violet-500 shadow-2xl shadow-violet-500/20 scale-[1.02] ring-4 ring-violet-500/10'
                                                    : isPopular
                                                        ? 'border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:border-violet-300 dark:hover:border-violet-600 hover:-translate-y-1'
                                                        : isBestValue
                                                            ? 'border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:border-violet-300 dark:hover:border-violet-600 hover:-translate-y-1'
                                                            : 'border-slate-100 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-xl hover:-translate-y-1'
                                                    }`}
                                                onClick={() => handleSelectPackage(pkg)}
                                            >
                                                {/* Badge */}
                                                {isPopular && !isBestValue && (
                                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold uppercase shadow-lg shadow-pink-500/30 whitespace-nowrap">
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            {t("popular")}
                                                        </span>
                                                    </div>
                                                )}
                                                {isBestValue && (
                                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold uppercase shadow-lg shadow-orange-500/30 whitespace-nowrap">
                                                            <Gift className="w-3.5 h-3.5" />
                                                            {t("bestValue")}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Package Header */}
                                                <div className="flex items-center gap-3 mb-5 sm:mb-6 mt-2">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/10'}`}>
                                                        <Coins className={`w-6 h-6 ${isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-violet-500'}`} />
                                                    </div>
                                                    <h3 className={`text-xs font-black tracking-tight ${isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-slate-900 dark:text-white'}`}>
                                                        {pkg.name}
                                                    </h3>
                                                </div>

                                                {/* Description */}
                                                {pkg.description && (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                                                        {pkg.description}
                                                    </p>
                                                )}

                                                {/* Price & Credits */}
                                                <div className={`mb-6 p-4 rounded-2xl border transition-colors ${isSelected ? 'bg-violet-50/50 dark:bg-violet-500/5 border-violet-100 dark:border-violet-500/20' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50'}`}>
                                                    {/* Price on top */}
                                                    <div className="mb-3 text-left">
                                                        <div className="text-[10px] font-bold  text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                                            {t("payment")}
                                                        </div>
                                                        <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                                                            {formatCurrency(pkg.price || pkg.priceVnd, pkg.currency)}
                                                        </div>
                                                    </div>

                                                    {/* Divider */}
                                                    <div className={`border-t my-3 border-dashed ${isSelected ? 'border-violet-200 dark:border-violet-500/30' : 'border-slate-200 dark:border-slate-700'}`}></div>

                                                    {/* Credits on bottom */}
                                                    <div className="text-left">
                                                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                                            {t("receive")}
                                                        </div>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className={`text-2xl sm:text-3xl font-black tracking-tight ${isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                                {pkg.credits.toLocaleString()}
                                                            </span>
                                                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                                                                CR.
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Features */}
                                                <div className="space-y-3 mb-6 mt-auto">
                                                    <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                                                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        <span className="font-medium">{t("unlimitedLifetime")}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                                                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        <span className="font-medium">{t("fullVipAccess")}</span>
                                                    </div>
                                                </div>

                                                <button
                                                    className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 mt-auto ${isSelected
                                                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/20 group-hover:text-violet-600 dark:group-hover:text-violet-400'
                                                        }`}
                                                >
                                                    <CreditCard className="w-4 h-4" />
                                                    {isSelected ? t("selected") : t("selectPackage")}
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Custom Package Card */}
                                    <div
                                        className={`relative bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 border-2 transition-all duration-300 cursor-pointer flex flex-col group ${selectedPackage?.code === 'CUSTOM'
                                            ? 'border-violet-500 shadow-2xl shadow-violet-500/20 scale-[1.02] ring-4 ring-violet-500/10'
                                            : 'border-slate-100 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-xl hover:-translate-y-1'
                                            }`}
                                        onClick={() => handleSelectPackage({
                                            code: 'CUSTOM',
                                            name: t('customAmount'),
                                            priceVnd: customAmount || 0,
                                            currency: 'VND',
                                            credits: customAmount || 0,
                                            isActive: true,
                                            displayOrder: 999,
                                        })}
                                    >
                                        <div className="flex items-center gap-3 mb-5 sm:mb-6 mt-2">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedPackage?.code === 'CUSTOM' ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/10'}`}>
                                                <Coins className={`w-6 h-6 ${selectedPackage?.code === 'CUSTOM' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-violet-500'}`} />
                                            </div>
                                            <h3 className={`text-xs font-black tracking-tight ${selectedPackage?.code === 'CUSTOM' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-900 dark:text-white'}`}>
                                                {t("customAmount")}
                                            </h3>
                                        </div>

                                        {selectedPackage?.code === 'CUSTOM' ? (
                                            <div className="mb-6 relative">
                                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                                    <span className="text-slate-400 font-bold">₫</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1000"
                                                    value={customAmount === 0 ? '' : customAmount}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        const newVal = isNaN(val) ? 0 : val;
                                                        setCustomAmount(newVal);
                                                        setSelectedPackage({
                                                            code: 'CUSTOM',
                                                            name: t('customAmount'),
                                                            priceVnd: newVal,
                                                            currency: 'VND',
                                                            credits: newVal, // Giả sử quy đổi 1:1
                                                            isActive: true,
                                                            displayOrder: 999,
                                                        });
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full text-center text-3xl font-black font-sans border-2 rounded-2xl pl-10 pr-4 py-2 transition-all text-violet-700 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 placeholder:text-violet-200 dark:placeholder:text-violet-800"
                                                    placeholder="10000"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <div className="mb-6 flex justify-center items-center bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 h-[84px] group-hover:border-violet-200 dark:group-hover:border-violet-700 transition-colors">
                                                <span className="text-xl font-bold text-slate-400 dark:text-slate-500 group-hover:text-violet-400 transition-colors">{t("enterAmount")}</span>
                                            </div>
                                        )}

                                        <div className="space-y-3 mb-6 mt-auto">
                                            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                                                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <span className="font-medium">{t("customRate")}</span>
                                            </div>
                                            <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                                                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <span className="font-medium">{t("automatic247")}</span>
                                            </div>
                                        </div>

                                        <button
                                            disabled={customAmount < 6000 && selectedPackage?.code === 'CUSTOM'}
                                            className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 mt-auto ${customAmount < 6000 && selectedPackage?.code === 'CUSTOM'
                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                                : selectedPackage?.code === 'CUSTOM'
                                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/20 group-hover:text-violet-600 dark:group-hover:text-violet-400'
                                                }`}
                                            onClick={() => handleSelectPackage({
                                                code: 'CUSTOM',
                                                name: t('customAmount'),
                                                priceVnd: customAmount || 0,
                                                price: customAmount || 0,
                                                currency: 'VND', // Always VND for custom amount to support VietQR
                                                credits: customAmount || 0,
                                                isActive: true,
                                                displayOrder: 999,
                                            })}
                                        >
                                            <CreditCard className="w-4 h-4" />
                                            {selectedPackage?.code === 'CUSTOM' ? t("selected") : t("enterOption")}
                                        </button>
                                    </div>

                                </div>
                            ) : (
                                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-20 text-center">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-5 border border-slate-100 dark:border-slate-700">
                                        <Coins className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{t("noPackages")}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mt-2">{t("updateSystem")}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Payment Summary */}
                    <div className="w-full lg:w-[30%]">
                        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 lg:sticky lg:top-24">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-6 sm:mb-8 flex items-center gap-3 tracking-tight">
                                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                </div>
                                {t("invoice")}
                            </h2>

                            {selectedPackage ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-4 border-b border-dashed border-slate-200 dark:border-slate-700">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">{t("selectedPackage")}</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-right break-words max-w-[60%] leading-tight">{selectedPackage.name}</span>
                                    </div>

                                    <div className="flex justify-between items-center py-4 border-b border-dashed border-slate-200 dark:border-slate-700">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">{t("creditsReceived")}</span>
                                        <span className="font-black text-lg text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                            {selectedPackage.credits.toLocaleString()}
                                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500/70">CR</span>
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center pt-6 pb-2">
                                        <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-sm">{t("totalAmount")}</span>
                                        <span className="text-3xl font-black text-violet-600 dark:text-violet-400">
                                            {formatCurrency(selectedPackage.price || selectedPackage.priceVnd, selectedPackage.currency)}
                                        </span>
                                    </div>

                                    {/* Payment Method Selector */}
                                    <div className="pt-6 pb-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t("paymentMethod")}</p>
                                        <PaymentMethodSelector
                                            selected={paymentMethod}
                                            onSelect={setPaymentMethod}
                                            excludeMethods={selectedPackage.currency && selectedPackage.currency !== 'VND' ? ['vietqr'] : []}
                                        />
                                    </div>

                                    <button
                                        disabled={
                                            (selectedPackage.code === 'CUSTOM' && customAmount < 6000) ||
                                            isProcessing
                                        }
                                        className={`w-full mt-6 py-4 rounded-xl font-black text-base uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${(selectedPackage.code === 'CUSTOM' && customAmount < 6000) ||
                                            isProcessing
                                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-1'
                                            }`}
                                        onClick={handleCheckout}
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                {t("processing")}
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-5 h-5" />
                                                {t("checkout")}
                                            </>
                                        )}
                                    </button>

                                    <div className="text-center mt-6">
                                        <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                            {t("secureTransaction")}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 dark:border-slate-700">
                                        <Wallet className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{t("notSelected")}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{t("selectHint")}</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* VietQR Payment Modal */}
            {showPaymentModal && vietqrData && (
                <div className="fixed inset-0 flex items-center justify-center z-50 p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-violet-100 dark:border-slate-700 animate-in fade-in zoom-in duration-300">
                        <div className="p-2 sm:p-4">
                            <VietQRPayment
                                orderId={vietqrData.order_id}
                                qrImage={vietqrData.qr_image}
                                amount={vietqrData.amount_vnd}
                                transactionCode={vietqrData.transaction_code}
                                bankInfo={vietqrData.bank_info}
                                expiresAt={vietqrData.expires_at}
                                onSuccess={() => {
                                    setShowPaymentModal(false);
                                    window.location.href = `/${locale}/topup/success`;
                                }}
                                onCancel={() => {
                                    setShowPaymentModal(false);
                                    setVietqrData(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
