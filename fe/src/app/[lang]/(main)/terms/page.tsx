interface PageProps {
  params: Promise<{ lang: string }>;
}

const content = {
  vi: {
    title: "Điều khoản Dịch vụ",
    body: (
      <>
        <p>
          Điều khoản Dịch vụ này quy định các nguyên tắc sử dụng nền tảng AudioTruyen. Khi đăng ký tài khoản,
          truy cập hoặc sử dụng bất kỳ tính năng nào của hệ thống, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ toàn
          bộ nội dung dưới đây.
        </p>

        <h2>1. Phạm vi áp dụng</h2>
        <p>
          Điều khoản áp dụng đối với tất cả người dùng, bao gồm khách truy cập, thành viên đã đăng ký tài khoản,
          hội viên VIP và cộng tác viên tham gia cung cấp nội dung trên AudioTruyen.
        </p>

        <h2>2. Quy tắc sử dụng nền tảng</h2>
        <h3>2.1 Hành vi bị nghiêm cấm</h3>
        <ul>
          <li>Sử dụng công cụ tự động, bot hoặc script để thu thập, cào (crawl) dữ liệu audio và dữ liệu hệ thống.</li>
          <li>Spam bình luận, quảng cáo trái phép hoặc đăng tải nội dung gây nhiễu cộng đồng.</li>
          <li>
            Thực hiện hành vi phá hoại hệ thống như dò quét lỗ hổng, tấn công từ chối dịch vụ, can thiệp trái phép vào
            API, cơ sở dữ liệu hoặc hạ tầng vận hành.
          </li>
          <li>
            Giả mạo danh tính, mạo nhận quyền quản trị hoặc sử dụng tài khoản của bên thứ ba mà không có sự chấp thuận.
          </li>
        </ul>

        <h3>2.2 Biện pháp xử lý vi phạm</h3>
        <p>
          AudioTruyen có quyền áp dụng các biện pháp như cảnh báo, hạn chế tính năng, tạm khóa hoặc chấm dứt tài
          khoản tùy mức độ vi phạm. Trường hợp cần thiết, chúng tôi có thể phối hợp với cơ quan có thẩm quyền theo quy
          định pháp luật hiện hành.
        </p>

        <h2>3. Tài khoản người dùng và gói VIP/Hội viên</h2>
        <h3>3.1 Trách nhiệm bảo mật tài khoản</h3>
        <p>
          Người dùng có trách nhiệm bảo mật thông tin đăng nhập, mã xác thực và các thiết bị truy cập. Mọi hoạt động
          phát sinh từ tài khoản được xem là do chủ tài khoản thực hiện, trừ trường hợp chứng minh được có truy cập trái
          phép ngoài ý muốn và đã thông báo kịp thời cho AudioTruyen.
        </p>

        <h3>3.2 Chính sách nhắc nhở và gia hạn gói VIP</h3>
        <p>
          Đối với gói VIP/Hội viên, hệ thống có thể gửi thông báo nhắc nhở khi sắp hết hạn quyền lợi. Tùy theo chính
          sách từng thời điểm, một số gói có thể hỗ trợ cơ chế gia hạn tự động nếu người dùng chủ động kích hoạt và đồng
          ý phương thức thanh toán phù hợp.
        </p>
        <p>
          Người dùng cần chủ động kiểm tra trạng thái gói, lịch sử thanh toán và thông tin liên quan tại khu vực tài
          khoản cá nhân. Mọi thay đổi chính sách giá hoặc thời hạn sẽ được thông báo công khai trước khi áp dụng.
        </p>

        <h2>4. Từ chối bảo đảm và giới hạn trách nhiệm</h2>
        <h3>4.1 Tính liên tục của dịch vụ</h3>
        <p>
          AudioTruyen không cam kết hệ thống vận hành liên tục 100% thời gian. Dịch vụ có thể tạm gián đoạn do bảo trì
          định kỳ, nâng cấp kỹ thuật, sự cố hạ tầng hoặc các yếu tố khách quan ngoài khả năng kiểm soát hợp lý.
        </p>

        <h3>4.2 Dữ liệu cá nhân do người dùng tự quản lý</h3>
        <p>
          Chúng tôi không chịu trách nhiệm đối với thiệt hại phát sinh từ việc người dùng để lộ thông tin đăng nhập,
          mất thiết bị, truy cập từ môi trường không an toàn hoặc không tuân thủ khuyến nghị bảo mật cơ bản.
        </p>

        <h2>5. Quyền sở hữu trí tuệ</h2>
        <p>
          Toàn bộ nội dung audio, văn bản, hình ảnh, biểu tượng, giao diện và dữ liệu hệ thống thuộc quyền sở hữu hoặc
          quyền khai thác hợp pháp của AudioTruyen và/hoặc đối tác cấp phép liên quan.
        </p>
        <ul>
          <li>
            Nghiêm cấm tải lại, sao chép, phát tán hoặc re-upload nội dung audio từ hệ thống lên nền tảng khác (bao gồm
            nhưng không giới hạn YouTube, Spotify) vì mục đích thương mại khi chưa có chấp thuận bằng văn bản.
          </li>
          <li>
            Nghiêm cấm chỉnh sửa, cắt ghép hoặc sử dụng lại nội dung nhằm gây nhầm lẫn về nguồn gốc phát hành.
          </li>
        </ul>

        <h2>6. Điều chỉnh điều khoản</h2>
        <p>
          AudioTruyen có quyền cập nhật Điều khoản Dịch vụ để phản ánh thay đổi pháp lý, mô hình vận hành hoặc nhu cầu
          cải thiện dịch vụ. Phiên bản mới có hiệu lực kể từ thời điểm công bố trên nền tảng.
        </p>

        <h2>7. Liên hệ</h2>
        <p>
          Nếu có thắc mắc liên quan đến Điều khoản Dịch vụ, người dùng vui lòng liên hệ bộ phận hỗ trợ của AudioTruyen
          qua các kênh được công bố chính thức trên nền tảng.
        </p>
      </>
    ),
  },
  en: {
    title: "Terms of Service",
    body: (
      <>
        <p>
          These Terms of Service set out the rules for using the AudioTruyen platform. By registering an account,
          accessing, or using any feature of the system, you acknowledge that you have read, understood, and agreed to
          comply with all terms below.
        </p>

        <h2>1. Scope of Application</h2>
        <p>
          These terms apply to all users, including visitors, registered account holders, VIP members, and contributors
          who participate in providing content on AudioTruyen.
        </p>

        <h2>2. Platform Usage Rules</h2>
        <h3>2.1 Prohibited Conduct</h3>
        <ul>
          <li>Using automated tools, bots, or scripts to collect or crawl audio and system data.</li>
          <li>Spamming comments, posting unauthorized advertising, or publishing disruptive content.</li>
          <li>
            Conducting system abuse such as vulnerability probing, denial-of-service attacks, or unauthorized interference
            with APIs, databases, or operational infrastructure.
          </li>
          <li>
            Impersonating identities, misrepresenting administrative authority, or using third-party accounts without permission.
          </li>
        </ul>

        <h3>2.2 Enforcement Measures</h3>
        <p>
          AudioTruyen may apply measures such as warnings, feature restrictions, temporary suspension, or account
          termination depending on violation severity. Where necessary, we may cooperate with competent authorities in
          accordance with applicable law.
        </p>

        <h2>3. User Accounts and VIP/Membership Plans</h2>
        <h3>3.1 Account Security Responsibility</h3>
        <p>
          Users are responsible for protecting login credentials, verification codes, and access devices. Activities
          under an account are deemed to be performed by the account owner, unless unauthorized access is proven and
          promptly reported to AudioTruyen.
        </p>

        <h3>3.2 Reminder and Renewal Policy for VIP Plans</h3>
        <p>
          For VIP/Membership plans, the system may send reminders before benefits expire. Depending on policy in each
          period, some plans may support auto-renewal if users proactively enable it and agree to an appropriate payment method.
        </p>
        <p>
          Users should proactively check plan status, payment history, and relevant information in their account area.
          Any pricing or duration policy updates will be publicly announced before taking effect.
        </p>

        <h2>4. Disclaimer and Limitation of Liability</h2>
        <h3>4.1 Service Continuity</h3>
        <p>
          AudioTruyen does not guarantee uninterrupted service 100% of the time. Service may be temporarily interrupted
          due to scheduled maintenance, technical upgrades, infrastructure incidents, or objective factors beyond reasonable control.
        </p>

        <h3>4.2 User-Managed Personal Data</h3>
        <p>
          We are not liable for damages arising from users disclosing login information, losing devices, accessing services from
          insecure environments, or failing to follow basic security recommendations.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          All audio content, text, images, icons, interfaces, and system data are owned by or lawfully licensed to
          AudioTruyen and/or relevant licensing partners.
        </p>
        <ul>
          <li>
            Re-downloading, copying, distributing, or re-uploading audio content from the system to other platforms
            (including but not limited to YouTube and Spotify) for commercial purposes is strictly prohibited without prior written consent.
          </li>
          <li>
            Editing, clipping, or reusing content in ways that mislead users about publishing origin is strictly prohibited.
          </li>
        </ul>

        <h2>6. Amendments</h2>
        <p>
          AudioTruyen may update these Terms of Service to reflect legal changes, operational model changes, or service
          improvement needs. New versions take effect upon publication on the platform.
        </p>

        <h2>7. Contact</h2>
        <p>
          For questions regarding the Terms of Service, users may contact AudioTruyen support via official channels
          published on the platform.
        </p>
      </>
    ),
  },
} as const;

export default async function TermsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang === "en" ? "en" : "vi";
  const t = content[lang as keyof typeof content] || content.vi;

  return (
    <div className="relative left-1/2 w-dvw -translate-x-1/2 -mt-8 bg-slate-50 dark:bg-gray-950 min-h-screen py-12">
      <div className="mx-auto w-full px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw]">
        <div className="p-2 md:p-4">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">{t.title}</h1>
          <div className="prose dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">{t.body}</div>
        </div>
      </div>
    </div>
  );
}
