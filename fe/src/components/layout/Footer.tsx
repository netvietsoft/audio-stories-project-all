import Link from "next/link";

export default function Footer () {
    return (
        <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Cột 1: Logo và giới thiệu */}
                <div className="mb-6 md:mb-0">
                    <Link href="/" className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        AudioTruyen
                    </Link>
                </div>
                {/* Cột 2: Các liên kết */}
                <div className="flex space-x-6 text-sm text-gray-500 dark:text-gray-400">
                    <Link href="/about" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                        Giới thiệu
                    </Link>
                    <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                        Điều khoản
                    </Link>
                    <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                        Bảo mật
                    </Link>
                    <Link href="/dmca" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                        DMCA
                    </Link>
                </div>
                {/* Dòng bản quyền */}
                <div className="mt-8 border-t border-gray-200 dark:border-gray-800 pt-8 flex justify-center">
                    <p className="text-sm text-gray-400">
                        &copy; {new Date().getFullYear()} AudioTruyen. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
}