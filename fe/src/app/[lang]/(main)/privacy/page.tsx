interface PageProps {
  params: Promise<{ lang: string }>;
}

const content = {
  vi: {
    title: "Chính sách Bảo mật",
    body: (
      <>
        <p>
          Chính sách Bảo mật này giải thích cách AudioTruyen thu thập, xử lý, lưu trữ và bảo vệ dữ liệu cá nhân của
          người dùng khi truy cập và sử dụng dịch vụ. Chúng tôi cam kết tiếp cận vấn đề bảo mật theo nguyên tắc minh
          bạch, tối thiểu hóa dữ liệu và bảo vệ quyền riêng tư.
        </p>

        <h2>1. Dữ liệu chúng tôi thu thập</h2>
        <h3>1.1 Dữ liệu định danh cơ bản</h3>
        <ul>
          <li>Email đăng ký tài khoản.</li>
          <li>Tên hiển thị và thông tin hồ sơ do người dùng chủ động cung cấp.</li>
        </ul>

        <h3>1.2 Dữ liệu hoạt động trên nền tảng</h3>
        <ul>
          <li>Lịch sử nghe truyện, tiến độ nghe và nội dung yêu thích.</li>
          <li>Đánh giá, bình luận và tương tác liên quan đến nội dung.</li>
          <li>Thông tin trạng thái hội viên/VIP và giao dịch liên quan trong phạm vi cần thiết.</li>
        </ul>

        <h2>2. Mục đích sử dụng dữ liệu</h2>
        <p>Dữ liệu được xử lý nhằm phục vụ hoạt động cốt lõi của nền tảng, bao gồm:</p>
        <ul>
          <li>Đề xuất truyện phù hợp với sở thích và hành vi nghe của từng người dùng.</li>
          <li>Đồng bộ lịch sử nghe giữa điện thoại, máy tính bảng và máy tính cá nhân.</li>
          <li>Gửi thông báo liên quan đến tài khoản, bao gồm nhắc nhở hết hạn gói VIP/Hội viên.</li>
          <li>Cải thiện chất lượng dịch vụ, tối ưu hiệu năng và xử lý sự cố kỹ thuật.</li>
        </ul>

        <h2>3. Cơ sở bảo vệ dữ liệu</h2>
        <h3>3.1 Bảo mật thông tin xác thực</h3>
        <p>
          Mật khẩu người dùng được mã hóa theo chuẩn bảo mật phù hợp và không lưu trữ dưới dạng văn bản thuần.
          Thông tin xác thực phiên đăng nhập được quản lý qua cơ chế token an toàn (JWT) với chính sách kiểm soát vòng
          đời token.
        </p>

        <h3>3.2 Bảo vệ dữ liệu và hạ tầng lưu trữ</h3>
        <p>
          Dữ liệu hệ thống và tệp phương tiện được lưu trữ trên hạ tầng cloud có áp dụng các lớp bảo vệ truy cập phù
          hợp. Chúng tôi triển khai biện pháp giám sát, phân quyền và kiểm soát kỹ thuật nhằm hạn chế truy cập trái
          phép.
        </p>

        <h3>3.3 Cam kết không mua bán dữ liệu</h3>
        <p>
          AudioTruyen không bán dữ liệu cá nhân của người dùng cho bên thứ ba. Việc chia sẻ dữ liệu (nếu có) chỉ diễn
          ra trong phạm vi cần thiết để vận hành dịch vụ, tuân thủ nghĩa vụ pháp lý hoặc khi có sự đồng ý hợp lệ từ
          người dùng.
        </p>

        <h2>4. Thời gian lưu trữ dữ liệu</h2>
        <p>
          Dữ liệu được lưu trữ trong thời gian cần thiết để cung cấp dịch vụ, giải quyết tranh chấp, tuân thủ yêu cầu
          pháp lý và thực hiện nghĩa vụ kế toán hoặc báo cáo theo quy định hiện hành.
        </p>

        <h2>5. Quyền của người dùng</h2>
        <p>Người dùng có các quyền liên quan đến dữ liệu cá nhân, bao gồm:</p>
        <ul>
          <li>Yêu cầu truy cập và trích xuất dữ liệu cá nhân mà hệ thống đang lưu giữ.</li>
          <li>Yêu cầu chỉnh sửa dữ liệu không chính xác hoặc đã lỗi thời.</li>
          <li>
            Yêu cầu xóa vĩnh viễn tài khoản và toàn bộ lịch sử nghe, thực hiện quyền được quên (Right to be forgotten)
            theo phạm vi pháp luật cho phép.
          </li>
        </ul>

        <h2>6. Cập nhật chính sách</h2>
        <p>
          AudioTruyen có thể điều chỉnh Chính sách Bảo mật để phản ánh thay đổi về pháp lý, kỹ thuật hoặc mô hình dịch
          vụ. Phiên bản cập nhật sẽ được công bố công khai trên nền tảng và có hiệu lực kể từ thời điểm đăng tải.
        </p>

        <h2>7. Liên hệ về bảo mật dữ liệu</h2>
        <p>
          Mọi yêu cầu liên quan đến quyền dữ liệu cá nhân, người dùng vui lòng gửi thông tin qua kênh hỗ trợ chính thức
          của AudioTruyen để được xác minh và xử lý theo quy trình nội bộ.
        </p>
      </>
    ),
  },
  en: {
    title: "Privacy Policy",
    body: (
      <>
        <p>
          This Privacy Policy explains how AudioTruyen collects, processes, stores, and protects users' personal data
          when users access and use the service. We are committed to data protection based on transparency, data minimization,
          and respect for privacy rights.
        </p>

        <h2>1. Data We Collect</h2>
        <h3>1.1 Basic Identity Data</h3>
        <ul>
          <li>Registered account email.</li>
          <li>Display name and profile information voluntarily provided by users.</li>
        </ul>

        <h3>1.2 Platform Activity Data</h3>
        <ul>
          <li>Listening history, listening progress, and favorite content.</li>
          <li>Ratings, comments, and content-related interactions.</li>
          <li>Membership/VIP status and relevant transaction information as necessary.</li>
        </ul>

        <h2>2. Purpose of Data Use</h2>
        <p>Data is processed to support core platform operations, including:</p>
        <ul>
          <li>Recommending stories based on each user's preferences and listening behavior.</li>
          <li>Synchronizing listening history across phones, tablets, and desktops.</li>
          <li>Sending account-related notifications, including VIP/Membership expiration reminders.</li>
          <li>Improving service quality, performance optimization, and technical issue handling.</li>
        </ul>

        <h2>3. Data Protection Foundations</h2>
        <h3>3.1 Authentication Security</h3>
        <p>
          User passwords are encrypted using appropriate security standards and are not stored in plain text.
          Session authentication data is managed through secure token mechanisms (JWT) with token lifecycle controls.
        </p>

        <h3>3.2 Data and Infrastructure Protection</h3>
        <p>
          System data and media files are stored on cloud infrastructure with appropriate access-protection layers.
          We implement monitoring, authorization, and technical controls to reduce unauthorized access risks.
        </p>

        <h3>3.3 Commitment Not to Sell Data</h3>
        <p>
          AudioTruyen does not sell users' personal data to third parties. Data sharing (if any) occurs only when
          necessary for service operations, legal compliance, or with valid user consent.
        </p>

        <h2>4. Data Retention Period</h2>
        <p>
          Data is retained for as long as necessary to provide services, resolve disputes, comply with legal obligations,
          and fulfill accounting or reporting duties under applicable regulations.
        </p>

        <h2>5. User Rights</h2>
        <p>Users have rights related to personal data, including:</p>
        <ul>
          <li>Requesting access to and export of personal data held by the system.</li>
          <li>Requesting correction of inaccurate or outdated data.</li>
          <li>
            Requesting permanent account deletion and complete listening history deletion, exercising the Right to Be Forgotten
            within the scope permitted by law.
          </li>
        </ul>

        <h2>6. Policy Updates</h2>
        <p>
          AudioTruyen may revise this Privacy Policy to reflect legal, technical, or service model changes.
          Updated versions will be publicly published on the platform and become effective from the posting time.
        </p>

        <h2>7. Privacy Contact</h2>
        <p>
          For requests regarding personal data rights, users may submit information through AudioTruyen's official
          support channels for verification and handling according to internal procedures.
        </p>
      </>
    ),
  },
} as const;

export default async function PrivacyPage({ params }: PageProps) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang === "en" ? "en" : "vi";
  const t = content[lang as keyof typeof content] || content.vi;

  return (
    <div className="relative left-1/2 w-dvw -translate-x-1/2 -mt-8 -mb-32 bg-slate-50 dark:bg-gray-950 min-h-screen py-12">
      <div className="mx-auto w-full px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw]">
        <div className="p-2 md:p-4">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">{t.title}</h1>
          <div className="prose dark:prose-invert max-w-none text-gray-900 dark:text-gray-100">{t.body}</div>
        </div>
      </div>
    </div>
  );
}
