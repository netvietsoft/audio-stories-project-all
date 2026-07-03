"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    Package,
    Plus,
    Edit2,
    Trash2,
    Loader2,
    X,
    Save,
    DollarSign,
    Coins,
    Eye,
    EyeOff,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';
import { unwrapList } from '@/lib/api/unwrap';
import AdminLanguageDropdown from '@/components/admin/AdminLanguageDropdown';
import { useAdminLanguages } from '@/hooks/useAdminLanguages';
import { formatThousand, parseThousand } from '@/lib/format-number';

interface PaymentPackage {
    code: string;
    name: string;
    priceVnd: number;
    lang?: string;
    pulseAmount?: number;
    credits?: number; // Legacy field for backward compatibility
    description?: string;
    isActive: boolean;
    isPopular?: boolean;
    isBestValue?: boolean;
    displayOrder: number;
    createdAt?: string;
    updatedAt?: string;
}

export default function PackagesPage() {
    const [packages, setPackages] = useState<PaymentPackage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCode, setEditingCode] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const params = useParams<{ lang?: string }>();
    const urlLang = params?.lang === 'en' ? 'en' : 'vi';
    const [selectedLocale, setSelectedLocale] = useState(urlLang);
    const { languages } = useAdminLanguages();
    const [formData, setFormData] = useState<Partial<PaymentPackage>>({
        code: '',
        name: '',
        priceVnd: 0,
        pulseAmount: 0,
        description: '',
        isActive: true,
        isPopular: false,
        isBestValue: false,
        displayOrder: 0,
        lang: 'vi',
    });

    useEffect(() => {
        fetchPackages();
    }, [selectedLocale]);

    useEffect(() => {
        if (!languages.some((language) => language.key === selectedLocale)) {
            setSelectedLocale(languages[0]?.key || 'vi');
        }
    }, [languages, selectedLocale]);

    const fetchPackages = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get(`/packages?lang=${selectedLocale}`);
            setPackages(unwrapList<PaymentPackage>(res.data).sort((a: PaymentPackage, b: PaymentPackage) => a.displayOrder - b.displayOrder));
        } catch (error) {
            console.error('Failed to fetch packages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (pkg?: PaymentPackage) => {
        if (pkg) {
            setEditingCode(pkg.code);
            setFormData(pkg);
        } else {
            setEditingCode(null);
            setFormData({
                code: '',
                name: '',
                priceVnd: 0,
                pulseAmount: 0,
                description: '',
                isActive: true,
                isPopular: false,
                isBestValue: false,
                displayOrder: packages.length,
                lang: selectedLocale,
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCode(null);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        
        console.log('=== FORM SUBMIT START ===');
        console.log('Form data:', formData);
        console.log('Editing code:', editingCode);
        
        // Validation
        if (!formData.code || !formData.name) {
            alert('Vui lòng điền đầy đủ thông tin bắt buộc (Code và tên gói)!');
            return;
        }
        
        if (formData.priceVnd === undefined || formData.pulseAmount === undefined) {
            alert('Vui lòng điền giá và số pulse!');
            return;
        }
        
        setIsSaving(true);
        try {
            console.log('Making API request...');
            
            if (editingCode) {
                // For update, only send allowed fields (exclude code, createdAt, updatedAt)
                const updateData = {
                    name: formData.name,
                    priceVnd: formData.priceVnd,
                    pulseAmount: formData.pulseAmount,
                    description: formData.description,
                    isActive: formData.isActive,
                    isPopular: formData.isPopular,
                    isBestValue: formData.isBestValue,
                    displayOrder: formData.displayOrder,
                    lang: selectedLocale,
                };
                console.log('PATCH request to:', `/packages/${editingCode}`);
                console.log('PATCH data:', updateData);
                const response = await apiClient.patch(`/packages/${editingCode}`, updateData);
                console.log('PATCH response:', response);
            } else {
                // For create, send all fields except timestamps
                const createData = {
                    code: formData.code,
                    name: formData.name,
                    priceVnd: formData.priceVnd,
                    pulseAmount: formData.pulseAmount,
                    description: formData.description,
                    isActive: formData.isActive,
                    isPopular: formData.isPopular,
                    isBestValue: formData.isBestValue,
                    displayOrder: formData.displayOrder,
                    lang: selectedLocale,
                };
                console.log('POST request to:', '/packages');
                console.log('POST data:', createData);
                const response = await apiClient.post('/packages', createData);
                console.log('POST response:', response);
            }
            
            console.log('=== FORM SUBMIT SUCCESS ===');
            handleCloseModal();
            fetchPackages();
        } catch (error: any) {
            console.error('=== FORM SUBMIT ERROR ===');
            console.error('Error object:', error);
            console.error('Error response:', error.response);
            console.error('Error message:', error.message);
            alert(error.response?.data?.message || 'Có lỗi xảy ra!');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (code: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa gói "${code}"?`)) return;

        try {
            await apiClient.delete(`/packages/${code}`);
            fetchPackages();
        } catch (error) {
            alert('Có lỗi xảy ra khi xóa gói!');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(amount);
    };

    const isEnglishLocale = selectedLocale === 'en';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Package className="w-6 h-6 text-white" />
                        </div>
                        Quản lý Gói Thanh toán
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Cấu hình các gói pulse và giá bán
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Locale Selector */}
                    <AdminLanguageDropdown
                        languages={languages}
                        value={selectedLocale}
                        onChange={setSelectedLocale}
                        selectClassName="focus:ring-emerald-500/20"
                    />
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
                    >
                        <Plus className="w-4 h-4" />
                        Thêm gói mới
                    </button>
                </div>
            </div>

            {/* Packages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.length > 0 ? (
                    packages.map((pkg) => (
                        <div
                            key={pkg.code}
                            className={`bg-white rounded-3xl border-2 p-6 shadow-sm hover:shadow-md transition-all relative ${
                                pkg.isActive ? 'border-emerald-200' : 'border-slate-200 opacity-60'
                            }`}
                        >
                            {/* Status Badge */}
                            <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                                {pkg.isActive ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-600 uppercase">
                                        <Eye className="w-3 h-3" /> Active
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-600 uppercase">
                                        <EyeOff className="w-3 h-3" /> Inactive
                                    </span>
                                )}
                                {pkg.isPopular && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-pink-50 border border-pink-100 text-[10px] font-black text-pink-600 uppercase">
                                        ⭐ Phổ biến
                                    </span>
                                )}
                                {pkg.isBestValue && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-600 uppercase">
                                        💎 Tiết kiệm
                                    </span>
                                )}
                            </div>

                            {/* Package Info */}
                            <div className="mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-4">
                                    <Coins className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-1">
                                    {pkg.name}
                                </h3>
                                <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                                    Code: {pkg.code}
                                </p>
                            </div>

                            {/* Price & Pulse */}
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Giá bán</span>
                                    <span className="text-lg font-black text-emerald-900">{formatCurrency(pkg.priceVnd)}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pulse</span>
                                    <span className="text-lg font-black text-amber-900">{(pkg.pulseAmount ?? pkg.credits ?? 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Description */}
                            {pkg.description && (
                                <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                                    {pkg.description}
                                </p>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => handleOpenModal(pkg)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Sửa
                                </button>
                                <button
                                    onClick={() => handleDelete(pkg.code)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Xóa
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full bg-white rounded-3xl border border-slate-200 p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Package className="w-6 h-6 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Chưa có gói nào</h3>
                        <p className="text-slate-500 mt-1 mb-4">Bắt đầu bằng cách thêm gói thanh toán đầu tiên.</p>
                        <button
                            onClick={() => handleOpenModal()}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Thêm gói mới
                        </button>
                    </div>
                )}
            </div>

            {/* Modal Create/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">
                                    {editingCode ? 'Chỉnh sửa Gói' : 'Thêm Gói Mới'}
                                </h2>
                                <p className="text-xs font-medium text-slate-500 mt-1">
                                    {editingCode ? `Code: ${editingCode}` : 'Tạo gói thanh toán mới'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Locale Selector in Modal */}
                                <AdminLanguageDropdown
                                    languages={languages}
                                    value={selectedLocale}
                                    onChange={setSelectedLocale}
                                    className="w-56"
                                    selectClassName="bg-slate-50 border-slate-200 py-2 text-xs focus:ring-emerald-500/20"
                                />
                                <button
                                    onClick={handleCloseModal}
                                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            console.log('Form submitted via onSubmit');
                            handleSubmit(e);
                        }} className="p-8 space-y-6">
                            {!editingCode && (
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                        Code (ID) *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code || ''}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        placeholder="vd: PACKAGE_10K"
                                        required
                                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                    Tên gói *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="vd: Gói 100 Pulse"
                                    required
                                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                        Giá (VND) *
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formatThousand(formData.priceVnd ?? 0)}
                                        onChange={(e) => setFormData({ ...formData, priceVnd: parseThousand(e.target.value) })}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="10000"
                                        required
                                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                        Pulse *
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formatThousand(formData.pulseAmount ?? 0)}
                                        onChange={(e) => setFormData({ ...formData, pulseAmount: parseThousand(e.target.value) })}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="100"
                                        required
                                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                    Mô tả
                                </label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    placeholder="Mô tả ngắn gọn về gói..."
                                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                        Thứ tự hiển thị
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.displayOrder ?? 0}
                                        onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                                        min="0"
                                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                        Trạng thái
                                    </label>
                                    <div className="flex items-center gap-3 h-[48px]">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                formData.isActive ? 'bg-emerald-600' : 'bg-slate-200'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                        <span className="text-sm font-medium text-slate-600">
                                            {formData.isActive ? 'Hoạt động' : 'Tắt'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                        Gói phổ biến
                                    </label>
                                    <div className="flex items-center gap-3 h-[48px]">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isPopular: !formData.isPopular })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                formData.isPopular ? 'bg-pink-600' : 'bg-slate-200'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    formData.isPopular ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                        <span className="text-sm font-medium text-slate-600">
                                            {formData.isPopular ? '⭐ Phổ biến' : 'Không'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                        Gói tiết kiệm
                                    </label>
                                    <div className="flex items-center gap-3 h-[48px]">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, isBestValue: !formData.isBestValue })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                formData.isBestValue ? 'bg-amber-600' : 'bg-slate-200'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    formData.isBestValue ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                        <span className="text-sm font-medium text-slate-600">
                                            {formData.isBestValue ? '💎 Tiết kiệm' : 'Không'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-6 py-3 text-sm font-black text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {isSaving ? 'Đang lưu...' : editingCode ? 'Cập nhật' : 'Tạo mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}


