import { ChevronDown } from "lucide-react";

interface PageProps {
  params: Promise<{ lang: string }>;
}

const content = {
  vi: {
    title: "Câu hỏi thường gặp",
    subtitle: "Giải đáp nhanh những vấn đề phổ biến khi sử dụng AudioTruyen.",
    items: [
      {
        q: "Làm sao để nạp credit?",
        a: "Bạn vào trang Tài khoản > Thanh toán, chọn gói credit phù hợp và hoàn tất giao dịch theo hướng dẫn.",
      },
      {
        q: "Tôi có thể tải truyện nghe offline không?",
        a: "Hiện tại hệ thống hỗ trợ nghe trực tuyến. Tính năng nghe offline đang được phát triển cho các gói hội viên tương thích.",
      },
      {
        q: "Làm thế nào để đổi mật khẩu?",
        a: "Vào Hồ sơ > Cài đặt tài khoản, chọn Đổi mật khẩu và xác nhận bằng email đăng ký.",
      },
      {
        q: "Tôi có thể hủy tài khoản không?",
        a: "Có. Bạn gửi yêu cầu qua trang Liên hệ hoặc Help Center, hệ thống sẽ xác minh và xử lý theo quy trình bảo mật.",
      },
      {
        q: "Tại sao truyện bị lỗi phát âm thanh?",
        a: "Bạn thử tải lại trang, kiểm tra kết nối mạng và xóa cache trình duyệt. Nếu vẫn lỗi, hãy gửi link chương qua mục Liên hệ.",
      },
    ],
  },
  en: {
    title: "Frequently Asked Questions",
    subtitle: "Quick answers to common questions when using AudioTruyen.",
    items: [
      {
        q: "How do I top up credits?",
        a: "Go to Account > Billing, choose a suitable credit package, and complete the payment process by following the instructions.",
      },
      {
        q: "Can I download stories for offline listening?",
        a: "Currently, streaming is supported. Offline mode is being developed for compatible membership plans.",
      },
      {
        q: "How can I change my password?",
        a: "Open Profile > Account Settings, select Change Password, and confirm via your registered email.",
      },
      {
        q: "Can I delete my account?",
        a: "Yes. Submit a request via Contact or Help Center. We will verify and process it according to our security policy.",
      },
      {
        q: "Why does audio playback fail on some chapters?",
        a: "Please refresh the page, check your network connection, and clear your browser cache. If the issue persists, send the chapter link to support.",
      },
    ],
  },
} as const;

export default async function FaqPage({ params }: PageProps) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang === "en" ? "en" : "vi";
  const t = content[lang as keyof typeof content] || content.vi;

  return (
    <div className="relative left-1/2 w-dvw -translate-x-1/2 -mt-8 bg-slate-50 dark:bg-gray-950 min-h-screen py-12">
      <div className="mx-auto w-full px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw]">
        <div className="p-2 md:p-4">
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
            <p className="text-gray-700 dark:text-gray-300">{t.subtitle}</p>
          </div>

          <div className="space-y-3 text-gray-700 dark:text-gray-300">
            {t.items.map((item, index) => (
              <details key={index} className="group rounded-xl bg-transparent px-4 py-3 outline-none">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  <span>{item.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-6">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
