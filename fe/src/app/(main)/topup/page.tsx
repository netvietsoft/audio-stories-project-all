"use client";

import { useState, useEffect } from 'react';
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
    credits: number;
    description?: string;
    isActive: boolean;
    displayOrder: number;
}

export default function TopupPage() {
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
            const res = await apiClient.get('/packages');
            const activePackages = res.data
                .filter((pkg: PaymentPackage) => pkg.isActive)
                .sort((a: PaymentPackage, b: PaymentPackage) => a.displayOrder - b.displayOrder);
            setPackages(activePackages);
        } catch (error) {
            console.error('Failed to fetch packages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(amount);
    };

    const handleSelectPackage = (pkg: PaymentPackage) => {
        setSelectedPackage(pkg);
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
                    success_url: `${window.location.origin}/topup/success`,
                    cancel_url: `${window.location.origin}/topup`,
                });
                if (res.data.url) {
                    window.location.href = res.data.url;
                }
            } else if (paymentMethod === 'paypal') {
                const res = await apiClient.post('/billing/paypal/create-order', {
                    package_code: selectedPackage.code,
                });
                if (res.data.approval_url) {
                    window.location.href = res.data.approval_url;
                }
            }
        } catch (error) {
            console.error('Payment error:', error);
            alert('Có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-900 mb-3 sm:mb-4">
                            <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 mb-2">
                            Nạp Credits
                        </h1>
                        <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto px-4">
                            Chọn gói credits phù hợp để trải nghiệm không giới hạn
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-7xl mx-auto">

                    {/* Left Side: Packages */}
                    <div className="w-full lg:w-[70%]">
                        <div className="mb-6 sm:mb-8">
                            {packages.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
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
                                                className={`relative bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 transition-all cursor-pointer flex flex-col ${isSelected
                                                    ? 'border-slate-900 shadow-xl shadow-slate-200 scale-[1.02] ring-4 ring-slate-100'
                                                    : isPopular
                                                        ? 'border-slate-400 shadow-xl shadow-slate-100 hover:-translate-y-1'
                                                        : isBestValue
                                                            ? 'border-slate-400 shadow-xl shadow-slate-100 hover:-translate-y-1'
                                                            : 'border-slate-200 hover:border-slate-400 hover:shadow-lg hover:-translate-y-1'
                                                    }`}
                                                onClick={() => handleSelectPackage(pkg)}
                                            >
                                                {/* Badge */}
                                                {isPopular && (
                                                    <div className="absolute -top-2 sm:-top-3 left-1/2 -translate-x-1/2 z-10">
                                                        <span className="inline-flex items-center gap-1 px-3 sm:px-4 py-1 rounded-full bg-slate-900 text-white text-xs font-black uppercase shadow-lg whitespace-nowrap">
                                                            <Sparkles className="w-3 h-3" />
                                                            Phổ biến
                                                        </span>
                                                    </div>
                                                )}
                                                {isBestValue && (
                                                    <div className="absolute -top-2 sm:-top-3 left-1/2 -translate-x-1/2 z-10">
                                                        <span className="inline-flex items-center gap-1 px-3 sm:px-4 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-300 text-xs font-black uppercase shadow-sm whitespace-nowrap">
                                                            <Gift className="w-3 h-3" />
                                                            Cơ bản
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Package Header */}
                                                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 bg-slate-100 border border-slate-200">
                                                        <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700" />
                                                    </div>
                                                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                                        {pkg.name}
                                                    </h3>
                                                </div>

                                                {/* Description */}
                                                {pkg.description && (
                                                    <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
                                                        {pkg.description}
                                                    </p>
                                                )}

                                                {/* Credits & Price */}
                                                <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                                            {pkg.credits.toLocaleString()}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                            Credits
                                                        </span>
                                                    </div>
                                                    <div className="text-left sm:text-right">
                                                        <span className="text-lg sm:text-xl font-black text-slate-900">
                                                            {formatCurrency(pkg.priceVnd)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Features */}
                                                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                                                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                                                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                        <span>Không giới hạn thời gian</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                                                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                        <span>Mọi nội dung</span>
                                                    </div>
                                                </div>

                                                <button
                                                    className={`w-full py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 border-2 mt-auto ${isSelected
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                                        : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <CreditCard className="w-4 h-4" />
                                                    {isSelected ? 'Đã chọn' : 'Chọn gói'}
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Custom Package Card */}
                                    <div
                                        className={`relative bg-white rounded-3xl p-6 border-2 transition-all cursor-pointer flex flex-col ${selectedPackage?.code === 'CUSTOM'
                                            ? 'border-slate-900 shadow-xl shadow-slate-200 scale-[1.02] ring-4 ring-slate-100'
                                            : 'border-slate-200 hover:border-slate-400 hover:shadow-lg hover:-translate-y-1'
                                            }`}
                                        onClick={() => handleSelectPackage({
                                            code: 'CUSTOM',
                                            name: 'Gói Tuỳ Chọn',
                                            priceVnd: customAmount || 0,
                                            credits: customAmount || 0,
                                            isActive: true,
                                            displayOrder: 999,
                                        })}
                                    >
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-slate-100 border border-slate-200">
                                                <Coins className="w-6 h-6 text-slate-700" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                                Tuỳ chọn thanh toán của bạn
                                            </h3>
                                        </div>

                                        <p className="text-sm text-slate-500 mb-6">
                                            Nhập số tiền bạn muốn nạp
                                        </p>

                                        {selectedPackage?.code === 'CUSTOM' ? (
                                            <div className="mb-6">
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
                                                            name: 'Gói Tuỳ Chọn',
                                                            priceVnd: newVal,
                                                            credits: newVal, // Giả sử quy đổi 1:1
                                                            isActive: true,
                                                            displayOrder: 999,
                                                        });
                                                    }}
                                                    onClick={(e) => e.stopPropagation()} // Để không bị conflict với thẻ bọc
                                                    className="w-full text-center text-2xl font-black font-sans border flex-1 rounded-xl px-4 py-3 focus:outline-none transition-all mb-1 text-slate-900 bg-white border-slate-300 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                                                    placeholder="10000"
                                                />
                                            </div>
                                        ) : (
                                            <div className="mb-6 flex justify-center items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 h-[76px]">
                                                <span className="text-lg font-bold text-slate-500">Nhập số tiền</span>
                                            </div>
                                        )}

                                        <div className="space-y-3 mb-6">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                <span>Không giới hạn thời gian</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                <span>Mọi nội dung</span>
                                            </div>
                                        </div>

                                        <button
                                            disabled={customAmount < 6000 && selectedPackage?.code === 'CUSTOM'}
                                            className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 border-2 mt-auto ${customAmount < 6000 && selectedPackage?.code === 'CUSTOM'
                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                    : selectedPackage?.code === 'CUSTOM'
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                                        : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400'
                                                }`}
                                        >
                                            <CreditCard className="w-4 h-4" />
                                            {selectedPackage?.code === 'CUSTOM' ? 'Đã chọn' : 'Chọn gói'}
                                        </button>
                                    </div>

                                </div>
                            ) : (
                                <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <Coins className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">Chưa có gói nào</h3>
                                    <p className="text-slate-500 mt-1">Vui lòng quay lại sau.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Payment Summary */}
                    <div className="w-full lg:w-[30%]">
                        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-slate-200 lg:sticky lg:top-8">
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-4 sm:mb-6 flex items-center gap-2 tracking-tight">
                                <Wallet className="w-5 h-5 text-slate-700" />
                                Thông tin thanh toán
                            </h2>

                            {selectedPackage ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                        <span className="text-slate-600 font-medium">Gói đã chọn</span>
                                        <span className="font-bold text-slate-900 text-right">{selectedPackage.name}</span>
                                    </div>

                                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                        <span className="text-slate-600 font-medium">Số credits</span>
                                        <span className="font-bold text-slate-900 flex items-center gap-1">
                                            <Coins className="w-4 h-4 text-emerald-500" />
                                            {selectedPackage.credits.toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center pt-2 pb-4 border-b border-slate-100">
                                        <span className="text-slate-600 font-bold">Tổng số tiền</span>
                                        <span className="text-2xl font-black text-slate-900">
                                            {formatCurrency(selectedPackage.priceVnd)}
                                        </span>
                                    </div>

                                    {/* Payment Method Selector */}
                                    <div className="pt-4">
                                        <PaymentMethodSelector
                                            selected={paymentMethod}
                                            onSelect={setPaymentMethod}
                                        />
                                    </div>

                                    <button
                                        disabled={
                                            (selectedPackage.code === 'CUSTOM' && customAmount < 6000) ||
                                            isProcessing
                                        }
                                        className={`w-full mt-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                                            (selectedPackage.code === 'CUSTOM' && customAmount < 6000) ||
                                            isProcessing
                                                ? 'bg-slate-100 text-slate-400 border-2 border-slate-200 cursor-not-allowed'
                                                : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5'
                                        }`}
                                        onClick={handleCheckout}
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Đang xử lý...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-5 h-5" />
                                                Thanh toán ngay
                                                <ArrowRight className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>

                                    <div className="text-center mt-4">
                                        <div className="inline-flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                                            <Check className="w-3 h-3 text-emerald-500" />
                                            Giao dịch an toàn & bảo mật
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 px-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <Coins className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-md font-bold text-slate-900 mb-1">Chưa chọn gói</h3>
                                    <p className="text-sm text-slate-500">Vui lòng chọn một gói credits bên trái để tiếp tục thanh toán</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* VietQR Payment Modal */}
            {showPaymentModal && vietqrData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <VietQRPayment
                                orderId={vietqrData.order_id}
                                qrImage={vietqrData.qr_image}
                                amount={vietqrData.amount_vnd}
                                transactionCode={vietqrData.transaction_code}
                                bankInfo={vietqrData.bank_info}
                                expiresAt={vietqrData.expires_at}
                                onSuccess={() => {
                                    setShowPaymentModal(false);
                                    window.location.href = '/topup/success';
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
