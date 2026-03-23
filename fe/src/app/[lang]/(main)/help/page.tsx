import { CreditCard, LifeBuoy, ShieldAlert, UserRound } from "lucide-react";

interface PageProps {
  params: Promise<{ lang: string }>;
}

const content = {
  vi: {
    title: "Trung tâm trợ giúp",
    subtitle: "Tìm kiếm hướng dẫn nhanh cho mọi vấn đề bạn gặp phải.",
    searchPlaceholder: "Tìm câu hỏi hoặc chủ đề hỗ trợ...",
    categories: [
      { title: "Tài khoản", description: "Đăng nhập, bảo mật, cập nhật hồ sơ", icon: UserRound },
      { title: "Thanh toán", description: "Nạp credit, lịch sử giao dịch, hóa đơn", icon: CreditCard },
      { title: "Lỗi kỹ thuật", description: "Không phát được audio, lỗi tải trang", icon: LifeBuoy },
      { title: "Bản quyền", description: "Báo cáo DMCA và vấn đề sở hữu nội dung", icon: ShieldAlert },
    ],
  },
  en: {
    title: "Help Center",
    subtitle: "Find quick guidance for any issue you are facing.",
    searchPlaceholder: "Search questions or support topics...",
    categories: [
      { title: "Account", description: "Login, security, profile updates", icon: UserRound },
      { title: "Billing", description: "Credit top-ups, payment history, and invoices", icon: CreditCard },
      { title: "Technical Issues", description: "Playback failures, loading errors", icon: LifeBuoy },
      { title: "Copyright", description: "DMCA reports and ownership claims", icon: ShieldAlert },
    ],
  },
} as const;

export default async function HelpPage({ params }: PageProps) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang === "en" ? "en" : "vi";
  const t = content[lang as keyof typeof content] || content.vi;

  return (
    <div className="relative left-1/2 w-dvw -translate-x-1/2 -mt-8 -mb-32 bg-slate-50 dark:bg-gray-950 min-h-screen py-12">
      <div className="mx-auto w-full px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw]">
        <div className="p-2 md:p-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
            <p className="mx-auto mt-2 max-w-2xl text-gray-700 dark:text-gray-300">{t.subtitle}</p>
            <div className="mx-auto mt-6 max-w-2xl">
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                className="w-full rounded-lg bg-transparent p-3 text-gray-900 outline-none dark:text-white"
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.categories.map((item, index) => {
              const Icon = item.icon;

              return (
                <div key={index} className="rounded-xl bg-transparent p-5 outline-none transition-colors hover:bg-white/40 dark:hover:bg-gray-900/30">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">{item.title}</h2>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
