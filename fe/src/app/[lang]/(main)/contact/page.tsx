import { isValidLocale } from "@/i18n";

type PageProps = {
  params: {
    lang: string;
  };
};

const content = {
  vi: {
    title: "Liên hệ",
    subtitle: "Chúng tôi luôn sẵn sàng hỗ trợ và lắng nghe ý kiến của bạn.",
    infoTitle: "Thông tin liên hệ",
    email: "Email",
    address: "Địa chỉ",
    social: "Mạng xã hội",
    addressValue: "Tầng 6, 123 Trần Hưng Đạo, Quận 1, TP. Hồ Chí Minh",
    followUs: "Theo dõi để nhận cập nhật mới nhất",
    formTitle: "Gửi tin nhắn",
    name: "Họ và tên",
    subject: "Tiêu đề",
    message: "Nội dung",
    send: "Gửi liên hệ",
    placeholders: {
      name: "Nhập họ tên của bạn",
      email: "Nhập email",
      subject: "Vấn đề cần hỗ trợ",
      message: "Mô tả chi tiết yêu cầu của bạn...",
    },
  },
  en: {
    title: "Contact",
    subtitle: "We are always ready to support and listen to your feedback.",
    infoTitle: "Contact Information",
    email: "Email",
    address: "Address",
    social: "Social Media",
    addressValue: "Floor 6, 123 Tran Hung Dao, District 1, Ho Chi Minh City",
    followUs: "Follow us for latest updates",
    formTitle: "Send a message",
    name: "Full name",
    subject: "Subject",
    message: "Message",
    send: "Send message",
    placeholders: {
      name: "Enter your full name",
      email: "Enter your email",
      subject: "Topic you need help with",
      message: "Describe your request in detail...",
    },
  },
} as const;

export default function ContactPage({ params }: PageProps) {
  const locale = isValidLocale(params.lang) ? params.lang : "vi";
  const t = content[locale];

  return (
    <div className="relative left-1/2 w-dvw -translate-x-1/2 -mt-8 -mb-32 bg-slate-50 dark:bg-gray-950 min-h-screen py-12">
      <div className="mx-auto w-full px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw]">
        <div className="p-2 md:p-4">
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
            <p className="text-gray-700 dark:text-gray-300">{t.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 text-gray-700 dark:text-gray-300">
            <div className="p-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.infoTitle}</h2>
              <div className="mt-5 space-y-5 text-sm">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{t.email}</p>
                  <p>support@audiotruyen.com</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{t.address}</p>
                  <p>{t.addressValue}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{t.social}</p>
                  <p>{t.followUs}</p>
                  <div className="mt-2 flex items-center gap-3 text-blue-600 dark:text-blue-400">
                    <a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
                    <a href="https://youtube.com" target="_blank" rel="noreferrer">YouTube</a>
                    <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
                  </div>
                </div>
              </div>
            </div>

            <form className="p-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.formTitle}</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">{t.name}</label>
                  <input
                    type="text"
                    placeholder={t.placeholders.name}
                    className="w-full rounded-lg bg-transparent p-3 text-gray-900 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">{t.email}</label>
                  <input
                    type="email"
                    placeholder={t.placeholders.email}
                    className="w-full rounded-lg bg-transparent p-3 text-gray-900 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">{t.subject}</label>
                  <input
                    type="text"
                    placeholder={t.placeholders.subject}
                    className="w-full rounded-lg bg-transparent p-3 text-gray-900 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">{t.message}</label>
                  <textarea
                    rows={5}
                    placeholder={t.placeholders.message}
                    className="w-full resize-none rounded-lg bg-transparent p-3 text-gray-900 outline-none dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  {t.send}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
