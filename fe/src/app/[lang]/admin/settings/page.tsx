"use client";

import React, { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    Save,
    Loader2,
    DollarSign,
    CreditCard,
    Info,
    Plus,
    Trash2,
    Edit2,
    X,
} from 'lucide-react';
import { adminApiClient as apiClient } from '@/lib/api/admin-api-client';

interface SettingItem {
    value: any;
    type: 'string' | 'number' | 'boolean' | 'json';
    description: string | null;
    updatedAt: string;
}

interface Settings {
    [key: string]: SettingItem;
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [modalData, setModalData] = useState({
        key: '',
        value: '',
        type: 'string' as 'string' | 'number' | 'boolean' | 'json',
        description: '',
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/settings');
            setSettings(res.data);
            
            const initialData: Record<string, any> = {};
            Object.entries(res.data).forEach(([key, setting]) => {
                initialData[key] = (setting as SettingItem).value;
            });
            setFormData(initialData);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiClient.patch('/settings/bulk', { settings: formData });
            alert('Cài đặt đã được lưu thành công!');
            fetchSettings();
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Có lỗi xảy ra khi lưu cài đặt!');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleOpenModal = (key?: string) => {
        if (key) {
            setEditingKey(key);
            const setting = settings[key];
            if (setting) {
                setModalData({
                    key,
                    value: typeof setting.value === 'object' ? JSON.stringify(setting.value, null, 2) : String(setting.value || ''),
                    type: setting.type,
                    description: setting.description || '',
                });
            }
        } else {
            setEditingKey(null);
            setModalData({ key: '', value: '', type: 'string', description: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingKey(null);
    };

    const handleSubmitModal = async () => {
        try {
            if (editingKey) {
                await apiClient.patch(`/settings/${editingKey}`, {
                    value: modalData.value,
                    type: modalData.type,
                    description: modalData.description,
                });
            } else {
                await apiClient.post('/settings', modalData);
            }
            handleCloseModal();
            fetchSettings();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Có lỗi xảy ra!');
        }
    };

    const handleDelete = async (key: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa cài đặt "${key}"?`)) return;
        try {
            await apiClient.delete(`/settings/${key}`);
            fetchSettings();
        } catch (error) {
            alert('Có lỗi xảy ra khi xóa cài đặt!');
        }
    };

    const renderInput = (key: string, setting: SettingItem) => {
        const value = formData[key];

        switch (setting.type) {
            case 'boolean':
                return (
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => handleChange(key, !value)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <span className="text-sm font-medium text-slate-600">{value ? 'Bật' : 'Tắt'}</span>
                    </div>
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={value || ''}
                        onChange={(e) => handleChange(key, parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                );
            case 'json':
                return (
                    <textarea
                        value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value || ''}
                        onChange={(e) => {
                            try {
                                handleChange(key, JSON.parse(e.target.value));
                            } catch {
                                handleChange(key, e.target.value);
                            }
                        }}
                        rows={4}
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                    />
                );
            default:
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                );
        }
    };

    const getSettingIcon = (key: string) => {
        if (key.includes('price') || key.includes('credit')) return <DollarSign className="w-5 h-5" />;
        if (key.includes('banner')) return <CreditCard className="w-5 h-5" />;
        return <Info className="w-5 h-5" />;
    };

    const getSettingLabel = (key: string) => {
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <SettingsIcon className="w-6 h-6 text-white" />
                        </div>
                        Cài đặt Hệ thống
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Quản lý các cấu hình và thông số của hệ thống</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
                    >
                        <Plus className="w-4 h-4" />
                        Thêm mới
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {Object.entries(settings).length > 0 ? (
                    Object.entries(settings).map(([key, setting]) => (
                        <div key={key} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                    {getSettingIcon(key)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{getSettingLabel(key)}</h3>
                                            {setting.description && <p className="text-xs text-slate-500 mt-1 font-medium">{setting.description}</p>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded uppercase tracking-wider shrink-0">{setting.type}</span>
                                            <button onClick={() => handleOpenModal(key)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Chỉnh sửa">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(key)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Xóa">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-3">{renderInput(key, setting)}</div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Cập nhật lần cuối: {new Date(setting.updatedAt).toLocaleString('vi-VN')}</p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <SettingsIcon className="w-6 h-6 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Chưa có cài đặt nào</h3>
                        <p className="text-slate-500 mt-1 mb-4">Bắt đầu bằng cách thêm cài đặt đầu tiên.</p>
                        <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all">
                            <Plus className="w-4 h-4" />
                            Thêm cài đặt mới
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <Info className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-indigo-900 mb-1">Lưu ý quan trọng</h4>
                        <p className="text-xs text-indigo-700 leading-relaxed">
                            Các thay đổi cài đặt sẽ ảnh hưởng trực tiếp đến hoạt động của hệ thống. Vui lòng kiểm tra kỹ trước khi lưu.
                        </p>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">{editingKey ? 'Chỉnh sửa Cài đặt' : 'Thêm Cài đặt Mới'}</h2>
                                <p className="text-xs font-medium text-slate-500 mt-1">{editingKey ? `Key: ${editingKey}` : 'Tạo cài đặt mới cho hệ thống'}</p>
                            </div>
                            <button onClick={handleCloseModal} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            {!editingKey && (
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Key (ID)</label>
                                    <input
                                        type="text"
                                        value={modalData.key}
                                        onChange={(e) => setModalData({ ...modalData, key: e.target.value })}
                                        placeholder="vd: credit_price_10k"
                                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Loại dữ liệu</label>
                                <select
                                    value={modalData.type}
                                    onChange={(e) => setModalData({ ...modalData, type: e.target.value as any })}
                                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="string">String (Chuỗi)</option>
                                    <option value="number">Number (Số)</option>
                                    <option value="boolean">Boolean (Đúng/Sai)</option>
                                    <option value="json">JSON (Đối tượng)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Giá trị</label>
                                <textarea
                                    value={modalData.value}
                                    onChange={(e) => setModalData({ ...modalData, value: e.target.value })}
                                    rows={4}
                                    placeholder="Nhập giá trị..."
                                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-slate-700 uppercase tracking-wider">Mô tả (tùy chọn)</label>
                                <input
                                    type="text"
                                    value={modalData.description}
                                    onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                                    placeholder="Mô tả ngắn gọn về cài đặt này..."
                                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-4 pt-4">
                                <button onClick={handleCloseModal} className="px-6 py-3 text-sm font-black text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest">
                                    Hủy
                                </button>
                                <button onClick={handleSubmitModal} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100">
                                    {editingKey ? 'Cập nhật' : 'Tạo mới'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
