interface PageProps {
  params: Promise<{ lang: string }>;
}

const supportEmail = "support@audiotruyen.com";

const content = {
  vi: {
    title: "Chính sách DMCA (Digital Millennium Copyright Act)",
    body: (
      <>
        <p>
          AudioTruyen tôn trọng quyền sở hữu trí tuệ của tác giả, nhà xuất bản, đơn vị phát hành và các chủ thể quyền
          liên quan. Chúng tôi cam kết tiếp nhận, xác minh và xử lý các khiếu nại bản quyền theo quy trình minh bạch,
          thiện chí và phù hợp với thông lệ pháp lý quốc tế.
        </p>

        <h2>1. Tuyên bố miễn trừ trách nhiệm nội dung</h2>
        <p>
          Một phần nội dung trên nền tảng có thể được đóng góp bởi người dùng hoặc cộng tác viên. AudioTruyen không
          mặc định khẳng định quyền sở hữu đối với toàn bộ nội dung do bên thứ ba cung cấp. Khi nhận được thông báo hợp
          lệ về vi phạm bản quyền, chúng tôi sẽ chủ động rà soát và áp dụng biện pháp cần thiết.
        </p>

        <h2>2. Điều kiện gửi thông báo gỡ bỏ (Takedown Notice)</h2>
        <p>
          Chủ sở hữu bản quyền hoặc đại diện hợp pháp cần cung cấp thông tin đầy đủ, trung thực và có khả năng kiểm
          chứng để yêu cầu xử lý. Thông báo cần bao gồm tối thiểu:
        </p>
        <ul>
          <li>Thông tin định danh người khiếu nại: họ tên, tổ chức (nếu có), chức danh, địa chỉ liên hệ.</li>
          <li>Mô tả rõ tác phẩm có bản quyền bị cho là xâm phạm.</li>
          <li>Đường dẫn gốc hoặc nguồn tham chiếu hợp pháp chứng minh quyền sở hữu.</li>
          <li>Đường dẫn cụ thể trên AudioTruyen chứa nội dung bị khiếu nại.</li>
          <li>
            Tuyên bố thiện chí rằng việc sử dụng nội dung đang bị khiếu nại chưa được chủ thể quyền cho phép.
          </li>
          <li>
            Tuyên bố chịu trách nhiệm trước pháp luật về tính chính xác của nội dung khiếu nại, kèm chữ ký điện tử hoặc
            chữ ký xác thực của chủ thể quyền/đại diện hợp pháp.
          </li>
        </ul>

        <h2>3. Quy trình xử lý khiếu nại bản quyền</h2>
        <h3>Bước 1: Tiếp nhận hồ sơ</h3>
        <p>
          Bộ phận phụ trách bản quyền ghi nhận yêu cầu, kiểm tra tính đầy đủ của thông tin và có thể phản hồi yêu cầu bổ
          sung nếu hồ sơ chưa hợp lệ.
        </p>

        <h3>Bước 2: Xác minh nội dung</h3>
        <p>
          Chúng tôi đối chiếu chứng cứ, xác định mức độ liên quan của nội dung bị báo cáo và đánh giá cơ sở pháp lý của
          yêu cầu gỡ bỏ.
        </p>

        <h3>Bước 3: Áp dụng biện pháp xử lý</h3>
        <p>
          Nếu khiếu nại hợp lệ, AudioTruyen sẽ thực hiện giới hạn truy cập hoặc gỡ bỏ nội dung vi phạm trong vòng 48
          đến 72 giờ làm việc kể từ thời điểm hoàn tất xác minh.
        </p>

        <h3>Bước 4: Thông báo kết quả</h3>
        <p>
          Chúng tôi gửi phản hồi kết quả xử lý cho bên khiếu nại qua kênh liên hệ đã đăng ký, đồng thời lưu hồ sơ theo
          quy trình nội bộ để phục vụ công tác kiểm tra, đối soát khi cần thiết.
        </p>

        <h2>4. Phản hồi của bên bị khiếu nại</h2>
        <p>
          Trong trường hợp nội dung bị gỡ bỏ tạm thời do khiếu nại, bên bị khiếu nại có quyền gửi phản hồi kèm chứng cứ
          chứng minh quyền sử dụng hợp pháp. AudioTruyen sẽ xem xét phản hồi một cách khách quan trước khi đưa ra quyết
          định cuối cùng.
        </p>

        <h2>5. Thông tin liên hệ DMCA</h2>
        <p>
          Mọi thông báo vi phạm bản quyền vui lòng gửi về: <strong>{supportEmail}</strong>
        </p>
        <p>
          Để đảm bảo thời gian xử lý nhanh, vui lòng ghi rõ tiêu đề email theo mẫu: <strong>[DMCA Notice] - Tên tác phẩm
          - Đường dẫn vi phạm</strong>.
        </p>
      </>
    ),
  },
  en: {
    title: "DMCA Policy (Digital Millennium Copyright Act)",
    body: (
      <>
        <p>
          AudioTruyen respects the intellectual property rights of authors, publishers, distributors, and related rights
          holders. We are committed to receiving, verifying, and handling copyright complaints through a transparent,
          good-faith process aligned with international legal practice.
        </p>

        <h2>1. Content Disclaimer</h2>
        <p>
          Some content on the platform may be contributed by users or collaborators. AudioTruyen does not automatically
          claim ownership over all third-party content. Upon receiving a valid copyright notice, we will proactively review
          and apply appropriate measures.
        </p>

        <h2>2. Requirements for Submitting a Takedown Notice</h2>
        <p>
          The copyright owner or authorized representative must provide complete, truthful, and verifiable information.
          A notice should include, at minimum:
        </p>
        <ul>
          <li>Claimant identity details: full name, organization (if any), title, and contact address.</li>
          <li>Clear description of the copyrighted work allegedly infringed.</li>
          <li>Original source link or lawful reference demonstrating ownership.</li>
          <li>Specific URL on AudioTruyen containing the allegedly infringing content.</li>
          <li>A good-faith statement that the complained use is not authorized by the rights holder.</li>
          <li>
            A statement under legal responsibility regarding accuracy of the complaint, with electronic signature or
            authenticated signature of the rights holder/authorized representative.
          </li>
        </ul>

        <h2>3. Copyright Complaint Handling Process</h2>
        <h3>Step 1: Intake</h3>
        <p>
          The copyright team records the request, checks completeness, and may request additional information if the
          submission is incomplete.
        </p>

        <h3>Step 2: Verification</h3>
        <p>
          We review the evidence, determine the relevance of the reported content, and assess the legal basis of the takedown request.
        </p>

        <h3>Step 3: Enforcement</h3>
        <p>
          If the complaint is valid, AudioTruyen will limit access to or remove infringing content within 48 to 72
          business hours after verification is completed.
        </p>

        <h3>Step 4: Result Notification</h3>
        <p>
          We notify the claimant of the outcome through registered contact channels and retain records under internal
          procedures for audit/reconciliation when necessary.
        </p>

        <h2>4. Response by the Reported Party</h2>
        <p>
          If content is temporarily removed due to a complaint, the reported party may submit a response with evidence
          of lawful usage. AudioTruyen will review the response objectively before making a final decision.
        </p>

        <h2>5. DMCA Contact Information</h2>
        <p>
          Please send copyright infringement notices to: <strong>{supportEmail}</strong>
        </p>
        <p>
          To help us process requests quickly, please use the email subject format: <strong>[DMCA Notice] - Work title
          - Infringing URL</strong>.
        </p>
      </>
    ),
  },
} as const;

export default async function DmcaPage({ params }: PageProps) {
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
