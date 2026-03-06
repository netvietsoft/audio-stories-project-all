"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    User, Mail, Shield, Calendar, CreditCard,
    Settings, LogOut, Edit2, ChevronRight,
    Award, Clock, Heart, BookOpen
} from "lucide-react";
import { useUserStore } from "@/stores/user-store";
import AvatarUpload from "@/components/profile/AvatarUpload";

export default function ProfilePage() {
    const router = useRouter();
    const { user } = useUserStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !user) {
            router.push("/login");
        }
    }, [mounted, user, router]);

    if (!mounted || !user) return null;

    return (
        <div className="max-w-7xl mx-auto pb-20">
            {/* Header Profile */}
            <div className="relative mb-8 pt-0">
                <div className="-bottom-16 left-8 flex flex-col md:flex-row items-center mb-16 md:items-end gap-6 w-full px-8 md:px-0">
                    <div className="relative group">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl border-4 border-white dark:border-gray-900 overflow-hidden bg-white shadow-2xl transition-transform group-hover:scale-[1.02]">
                            <img
                                src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || user.id}`}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <AvatarUpload />
                    </div>

                    <div className="mb-4 mt-4 text-center md:text-left">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white drop-shadow-sm flex items-center gap-3">
                            {user.name || "Người dùng"}
                            <Award className="w-6 h-6 text-amber-500" />
                        </h1>
                        <div className="flex items-center justify-center md:justify-start gap-3 mt-2">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-xs font-bold rounded-full uppercase tracking-wider shadow-sm">
                                {user.roles?.[0] || "Thành viên"}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-blue-500" /> Tham gia từ 2026
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 md:mt-24">
                {/* Left Column: Summary & Menu */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-3">
                            <Award className="w-5 h-5 text-amber-500" /> Thành tích cá nhân
                        </h3>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" /> Audio đã nghe
                                </span>
                                <span className="font-extrabold text-blue-600 dark:text-blue-400">124</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <Heart className="w-4 h-4" /> Truyện yêu thích
                                </span>
                                <span className="font-extrabold text-red-500">12</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Ngày hoạt động
                                </span>
                                <span className="font-extrabold text-green-500 font-mono">32</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Quản lý</p>
                        </div>
                        <button className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 group text-gray-700 dark:text-gray-200">
                            <Settings className="w-5 h-5 text-gray-400 group-hover:rotate-45 transition-transform" />
                            <span className="font-semibold">Cài đặt bảo mật</span>
                            <ChevronRight className="w-4 h-4 ml-auto text-gray-300" />
                        </button>
                        <button className="w-full flex items-center gap-3 px-6 py-4 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors border-b border-gray-100 dark:border-gray-700 group text-blue-600 dark:text-blue-400">
                            <CreditCard className="w-5 h-5" />
                            <span className="font-semibold text-blue-600 dark:text-blue-400">Nạp Credits</span>
                            <ChevronRight className="w-4 h-4 ml-auto" />
                        </button>
                    </div>
                </div>

                {/* Right Column: Detailed Info */}
                <div className="md:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <User className="w-32 h-32" />
                        </div>

                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Thông tin cơ bản</h2>
                                <p className="text-sm text-gray-500 mt-1">Thông tin cá nhân của bạn trên hệ thống</p>
                            </div>
                            <button className="md:hidden text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline">
                                Sửa
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
                            <div className="space-y-2">
                                <label className="text-xs font-extrabold text-gray-400 uppercase tracking-widest ml-1">Tên tài khoản</label>
                                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 group focus-within:border-blue-500 transition-colors">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                                        <User className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <span className="font-bold text-gray-700 dark:text-gray-200">{user.name || "N/A"}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-extrabold text-gray-400 uppercase tracking-widest ml-1">Địa chỉ Email</label>
                                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 group focus-within:border-blue-500 transition-colors">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                                        <Mail className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <span className="font-bold text-gray-700 dark:text-gray-200 break-all">{user.email}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-extrabold text-gray-400 uppercase tracking-widest ml-1">Xếp hạng thành viên</label>
                                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                                        <Shield className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded w-fit">
                                            Level {user.vipTier || 0}
                                        </span>
                                        {user.vipExpirationDate && (
                                            <span className="text-[10px] text-gray-400 font-medium italic">
                                                Hết hạn vào: {new Date(user.vipExpirationDate).toLocaleDateString("vi-VN")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-extrabold text-gray-400 uppercase tracking-widest ml-1">Ví Credit hiện có</label>
                                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-amber-900/30">
                                    <div className="p-2 bg-white dark:bg-amber-900/20 rounded-xl shadow-sm">
                                        <CreditCard className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-extrabold text-green-700 dark:text-green-400 text-lg leading-tight">{(user.credits).toLocaleString("vi-VN")}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hoạt động gần đây</h2>
                            <button className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700">Xem tất cả</button>
                        </div>
                        <div className="space-y-5">
                            {[
                                { icon: BookOpen, text: "Đã nghe xong chương 12 truyện Phàm Nhân Tu Tiên", time: "2 giờ trước", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
                                { icon: Heart, text: "Đã thêm Đấu Phá Thương Khung vào yêu thích", time: "Hôm qua", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
                                { icon: CreditCard, text: "Nạp 50,000đ vào tài khoản thành công", time: "3 ngày trước", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-5 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-default border border-transparent hover:border-gray-100 dark:hover:border-gray-700 group">
                                    <div className={`p-3 ${item.bg} rounded-2xl transition-transform group-hover:scale-110`}>
                                        <item.icon className={`w-6 h-6 ${item.color}`} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-base font-bold text-gray-800 dark:text-gray-100 line-clamp-1">{item.text}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{item.time}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
