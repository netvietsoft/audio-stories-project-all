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
import { useAuth } from '@/auth/auth-provider';
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector';
import type { PaymentMethod } from '@/components/payment/PaymentMethodSelector';
import VietQRPayment from '@/components/payment/VietQRPayment';
import { useUserStore } from '@/stores/user-store';
import { useAuthModalStore } from '@/stores/auth-modal-store';

interface PaymentPackage {
    code: string;
    title?: string;
    titleVi?: string;
    titleEn?: string;
    name: string;
    nameVi?: string;
    nameEn?: string;
    priceVnd: number;
    price?: number;
    currency?: string;
    lang?: string;
    credits: number;
    description?: string;
    descriptionVi?: string;
    descriptionEn?: string;
    isActive: boolean;
    displayOrder: number;
    isPopular?: boolean;
    isBestValue?: boolean;
}

export default function TopupPage() {
    const t = useTranslations("Topup");
    const locale = useLocale();
    const currentLocale: 'vi' | 'en' = locale === 'en' ? 'en' : 'vi';
    const usdToVndRateRaw = Number(process.env.NEXT_PUBLIC_USD_TO_VND_RATE || '25000');
    const usdToVndRate = Number.isFinite(usdToVndRateRaw) && usdToVndRateRaw > 0 ? usdToVndRateRaw : 25000;
    const [packages, setPackages] = useState<PaymentPackage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPackage, setSelectedPackage] = useState<PaymentPackage | null>(null);
    const [customAmount, setCustomAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('vietqr');
    const [isProcessing, setIsProcessing] = useState(false);
    const [vietqrData, setVietqrData] = useState<any>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    
    const user = useUserStore((state) => state.user);
    const openLogin = useAuthModalStore((state) => state.openLogin);
    const { refreshProfile } = useAuth();

    useEffect(() => {
        fetchPackages();
    }, [currentLocale]);

    const fetchPackages = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get(`/packages?lang=${currentLocale}`);
            const activePackages = res.data
                .filter((pkg: PaymentPackage) => pkg.isActive)
                .filter((pkg: PaymentPackage) => {
                    // Filter packages by locale - only show packages matching current locale
                    if (!pkg.lang) return true; // Show packages without lang field
                    return pkg.lang === currentLocale;
                })
                .sort((a: PaymentPackage, b: PaymentPackage) => a.displayOrder - b.displayOrder);
            setPackages(activePackages);

            const nextSelectedPackage = activePackages.find(
                (pkg: PaymentPackage) => pkg.code === selectedPackage?.code,
            );

            if (nextSelectedPackage) {
                handleSelectPackage(nextSelectedPackage);
            } else if (activePackages.length > 0) {
                const popularPackage = activePackages.find((pkg: PaymentPackage) => pkg.isPopular);
                handleSelectPackage(popularPackage || activePackages[0]);
            } else {
                setSelectedPackage(null);
            }
        } catch (error) {
            console.error('Failed to fetch packages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount: number, currency = 'VND') => {
        return new Intl.NumberFormat(currentLocale === 'vi' ? 'vi-VN' : 'en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    const getDisplayPrice = (pkg: PaymentPackage): { amount: number; currency: 'VND' | 'USD' } => {
        if (pkg.code === 'CUSTOM') {
            const customAmountVnd =
                typeof pkg.priceVnd === 'number' && pkg.priceVnd > 0
                    ? pkg.priceVnd
                    : typeof pkg.price === 'number' && pkg.price > 0
                        ? pkg.price
                        : 0;
            return { amount: customAmountVnd, currency: 'VND' };
        }

        if (currentLocale === 'en') {
            const packageCurrency = (pkg.currency || '').toUpperCase();
            const hasUsdPrice = packageCurrency === 'USD' && typeof pkg.price === 'number' && pkg.price > 0;

            if (hasUsdPrice) {
                return { amount: pkg.price as number, currency: 'USD' };
            }

            const fallbackVnd =
                typeof pkg.priceVnd === 'number' && pkg.priceVnd > 0
                    ? pkg.priceVnd
                    : typeof pkg.price === 'number' && pkg.price > 0
                        ? pkg.price
                        : 0;

            return { amount: fallbackVnd / usdToVndRate, currency: 'USD' };
        }

        const amountVnd =
            typeof pkg.priceVnd === 'number' && pkg.priceVnd > 0
                ? pkg.priceVnd
                : typeof pkg.price === 'number' && pkg.price > 0
                    ? pkg.price
                    : 0;

        return { amount: amountVnd, currency: 'VND' };
    };

    const getLocalizedPackageTitle = (pkg: PaymentPackage) => {
        if (currentLocale === 'vi') {
            return pkg.titleVi || pkg.nameVi || pkg.title || pkg.name;
        }
        return pkg.titleEn || pkg.nameEn || pkg.title || pkg.name;
    };

    const getLocalizedPackageDescription = (pkg: PaymentPackage) => {
        if (currentLocale === 'vi') {
            return pkg.descriptionVi || pkg.description;
        }
        return pkg.descriptionEn || pkg.description;
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
        
        // Check if user is logged in
        if (!user) {
            openLogin();
            return;
        }

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
            let errorMessage = error?.response?.data?.message || error?.message || '';
            
            // Translate common Stripe errors to Vietnamese
            if (currentLocale === 'vi') {
                if (errorMessage.includes('0.50') || errorMessage.includes('minimum') || errorMessage.toLowerCase().includes('amount must be at least')) {
                    errorMessage = 'Số tiền thanh toán tối thiểu qua Stripe là 0.5 USD (khoảng 12,500 VND). Vui lòng chọn gói khác hoặc sử dụng phương thức VietQR.';
                } else if (!errorMessage) {
                    errorMessage = 'Có lỗi xảy ra. Vui lòng thử lại.';
                }
            } else {
                if (!errorMessage) {
                    errorMessage = 'An error occurred. Please try again.';
                }
            }
            
            alert(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
                </div>
            </div>
        );
    }

    const selectedDisplayPrice = selectedPackage ? getDisplayPrice(selectedPackage) : null;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white font-sans dark:border-zinc-800 dark:bg-zinc-900">

            {/* Main Content Area */}
            <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-20">
                <div className="flex flex-col gap-6 lg:mx-auto lg:max-w-7xl lg:flex-row lg:gap-8">

                    {/* Left Side: Packages */}
                    <div className="w-full lg:w-[70%]">
                        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-[2rem] p-2 sm:p-4 shadow-xl shadow-slate-200/50 dark:shadow-none border border-white dark:border-zinc-800 mb-6 sm:mb-8">
                            {packages.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-5">
                                    {packages.map((pkg) => {
                                        // Use database flags for badges
                                        const isPopular = pkg.isPopular || false;
                                        const isBestValue = pkg.isBestValue || false;
                                        const isSelected = selectedPackage?.code === pkg.code;
                                        const displayPrice = getDisplayPrice(pkg);
                                        
                                        // Get localized name and description
                                        const packageName = getLocalizedPackageTitle(pkg);
                                        const packageDescription = getLocalizedPackageDescription(pkg);

                                        return (
                                            <div
                                                key={pkg.code}
                                                className={`relative bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 border-2 transition-all duration-300 cursor-pointer flex flex-col group ${isSelected
                                                    ? 'border-violet-500 shadow-2xl shadow-violet-500/20 scale-[1.02] ring-4 ring-violet-500/10'
                                                    : isPopular
                                                        ? 'border-gray-200 dark:border-zinc-800 shadow-lg hover:shadow-xl hover:border-violet-300 dark:hover:border-violet-600 hover:-translate-y-1'
                                                        : isBestValue
                                                            ? 'border-gray-200 dark:border-zinc-800 shadow-lg hover:shadow-xl hover:border-violet-300 dark:hover:border-violet-600 hover:-translate-y-1'
                                                            : 'border-gray-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-xl hover:-translate-y-1'
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
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-gray-100 dark:bg-zinc-800 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/10'}`}>
                                                        <Coins className={`w-6 h-6 ${isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-violet-500'}`} />
                                                    </div>
                                                    <h3 className={`text-xs font-black tracking-tight ${isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-slate-900 dark:text-white'}`}>
                                                        {packageName}
                                                    </h3>
                                                </div>

                                                {/* Description */}
                                                {packageDescription && (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                                                        {packageDescription}
                                                    </p>
                                                )}

                                                {/* Price & Credits */}
                                                <div className={`mb-6 p-4 rounded-2xl border transition-colors ${isSelected ? 'bg-violet-50/50 dark:bg-violet-500/5 border-violet-100 dark:border-violet-500/20' : 'bg-gray-50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800'}`}>
                                                    {/* Price on top */}
                                                    <div className="mb-3 text-left">
                                                        <div className="text-[10px] font-bold  text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                                            {t("payment")}
                                                        </div>
                                                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                                                            {formatCurrency(displayPrice.amount, displayPrice.currency)}
                                                        </div>
                                                    </div>

                                                    {/* Divider */}
                                                    <div className={`border-t my-3 border-dashed ${isSelected ? 'border-violet-200 dark:border-violet-500/30' : 'border-gray-200 dark:border-zinc-800'}`}></div>

                                                    {/* Credits on bottom */}
                                                    <div className="text-left">
                                                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                                            {t("receive")}
                                                        </div>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className={`text-xl sm:text-2xl font-black tracking-tight ${isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
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
                                                    className={`w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 mt-auto whitespace-nowrap ${isSelected
                                                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/20 group-hover:text-violet-600 dark:group-hover:text-violet-400'
                                                        }`}
                                                >
                                                    <CreditCard className="w-4 h-4 flex-shrink-0" />
                                                    <span className="truncate">{isSelected ? t("selected") : t("selectPackage")}</span>
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Custom Package Card */}
                                    <div
                                        className={`relative bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 border-2 transition-all duration-300 cursor-pointer flex flex-col group ${selectedPackage?.code === 'CUSTOM'
                                            ? 'border-violet-500 shadow-2xl shadow-violet-500/20 scale-[1.02] ring-4 ring-violet-500/10'
                                            : 'border-gray-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-xl hover:-translate-y-1'
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
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedPackage?.code === 'CUSTOM' ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-gray-100 dark:bg-zinc-800 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/10'}`}>
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
                                                <div className="mb-6 flex justify-center items-center bg-gray-50 dark:bg-zinc-900/50 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 h-[84px] group-hover:border-violet-200 dark:group-hover:border-violet-700 transition-colors">
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
                                            className={`w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 mt-auto whitespace-nowrap ${selectedPackage?.code === 'CUSTOM'
                                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/20 group-hover:text-violet-600 dark:group-hover:text-violet-400'
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
                                            <CreditCard className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{selectedPackage?.code === 'CUSTOM' ? t("selected") : t("selectPackage")}</span>
                                        </button>
                                    </div>

                                </div>
                            ) : (
                                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 p-20 text-center">
                                    <div className="w-20 h-20 bg-gray-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-200 dark:border-zinc-800">
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
                        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 sm:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-gray-200 dark:border-zinc-800 lg:sticky lg:top-24">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-6 sm:mb-8 flex items-center gap-3 tracking-tight">
                                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                                    <Wallet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                </div>
                                {t("invoice")}
                            </h2>

                            {selectedPackage ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-4 border-b border-dashed border-gray-200 dark:border-zinc-800">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">{t("selectedPackage")}</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-right break-words max-w-[60%] leading-tight">
                                            {selectedPackage.code === 'CUSTOM' ? selectedPackage.name : getLocalizedPackageTitle(selectedPackage)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center py-4 border-b border-dashed border-gray-200 dark:border-zinc-800">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">{t("creditsReceived")}</span>
                                        <span className="font-black text-lg text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                            {selectedPackage.credits.toLocaleString()}
                                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500/70">CR</span>
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center pt-6 pb-2">
                                        <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-sm">{t("totalAmount")}</span>
                                        <span className="text-3xl font-black text-violet-600 dark:text-violet-400">
                                            {selectedDisplayPrice ? formatCurrency(selectedDisplayPrice.amount, selectedDisplayPrice.currency) : ''}
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
                                        disabled={isProcessing}
                                        className={`w-full mt-6 py-4 rounded-xl font-black text-base uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isProcessing
                                            ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
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
                                <div className="text-center py-12 px-4 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                                    <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200 dark:border-zinc-800">
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
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}></div>
                    <div className="relative bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-violet-100 dark:border-zinc-800 animate-in fade-in zoom-in duration-300">
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
                                    (async () => {
                                        try {
                                            await refreshProfile();
                                        } catch (e) {
                                            // ignore
                                        } finally {
                                            window.location.href = `/${locale}/topup/success`;
                                        }
                                    })();
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
