import type { Metadata } from "next";

const SITE_NAME = "AudioTruyen";
const COPYRIGHT_SUPPORT_EMAIL = "[Email Hỗ Trợ Bản Quyền]";

export function generateMetadata(): Metadata {
  return {
    title: `DMCA | ${SITE_NAME}`,
    description:
      "Chính sách DMCA mô tả quy trình thông báo vi phạm bản quyền và cam kết xử lý gỡ bỏ nội dung sau xác minh.",
  };
}

export default function DmcaPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 py-6 md:py-8">
      <article className="prose max-w-none prose-slate dark:prose-invert">
        <h1>Chính sách DMCA (Digital Millennium Copyright Act)</h1>
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
          Mọi thông báo vi phạm bản quyền vui lòng gửi về: <strong>{COPYRIGHT_SUPPORT_EMAIL}</strong>
        </p>
        <p>
          Để đảm bảo thời gian xử lý nhanh, vui lòng ghi rõ tiêu đề email theo mẫu: <strong>[DMCA Notice] - Tên tác phẩm
          - Đường dẫn vi phạm</strong>.
        </p>
      </article>
    </section>
  );
}
