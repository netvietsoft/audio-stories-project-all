import Link from "next/link";
import { Headphones, Mail, Facebook, Youtube, Twitter } from "lucide-react";

export default function Footer() {
    return (
        <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

                    {/* Cột 1: Branding */}
                    <div className="lg:col-span-1">
                        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
                            <Headphones className="w-7 h-7" />
                            Netviet Audio
                        </Link>
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            Nền tảng nghe truyện audio chất lượng cao. Hàng ngàn cuốn truyện hay cập nhật mỗi ngày.
                        </p>
                        {/* Social links */}
                        <div className="mt-5 flex items-center gap-3">
                            <a
                                href="https://facebook.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-colors"
                                aria-label="Facebook"
                            >
                                <Facebook className="w-4 h-4" />
                            </a>
                            <a
                                href="https://youtube.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white transition-colors"
                                aria-label="YouTube"
                            >
                                <Youtube className="w-4 h-4" />
                            </a>
                            <a
                                href="https://twitter.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-sky-500 hover:text-white dark:hover:bg-sky-500 dark:hover:text-white transition-colors"
                                aria-label="Twitter"
                            >
                                <Twitter className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Cột 2: Khám phá */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
                            Khám phá
                        </h3>
                        <ul className="space-y-2.5">
                            {[
                                { href: "/", label: "Trang chủ" },
                                { href: "/new", label: "Mới cập nhật" },
                                { href: "/trending", label: "Đang thịnh hành" },
                                { href: "/categories", label: "Thể loại" },
                                { href: "/vinh-danh", label: "BXH Hội Viên" },
                            ].map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Cột 3: Tài khoản */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
                            Tài khoản
                        </h3>
                        <ul className="space-y-2.5">
                            {[
                                { href: "/login", label: "Đăng nhập" },
                                { href: "/register", label: "Đăng ký" },
                                { href: "/profile", label: "Trang cá nhân" },
                                { href: "/profile/favorites", label: "Truyện yêu thích" },
                                { href: "/topup", label: "Nạp Credits" },
                            ].map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Cột 4: Hỗ trợ */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">
                            Hỗ trợ
                        </h3>
                        <ul className="space-y-2.5">
                            {[
                                { href: "/about", label: "Giới thiệu" },
                                { href: "/terms", label: "Điều khoản dịch vụ" },
                                { href: "/privacy", label: "Chính sách bảo mật" },
                                { href: "/dmca", label: "DMCA" },
                            ].map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-5">
                            <a
                                href="mailto:support@netvietaudio.com"
                                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                                <Mail className="w-4 h-4 shrink-0" />
                                support@netvietaudio.com
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        &copy; {new Date().getFullYear()} Netviet Audio. All rights reserved.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        Mọi nội dung audio trên trang chỉ nhằm mục đích giải trí, không vi phạm bản quyền.
                    </p>
                </div>
            </div>
        </footer>
    );
}