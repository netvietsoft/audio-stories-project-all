import type { Metadata } from "next";

const SITE_NAME = "[Tên Website]";

export function generateMetadata(): Metadata {
  return {
    title: `Điều khoản dịch vụ | ${SITE_NAME}`,
    description:
      "Điều khoản dịch vụ quy định quyền, nghĩa vụ và giới hạn trách nhiệm khi sử dụng nền tảng nghe truyện audio.",
  };
}

export default function TermsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 py-6 md:py-8">
      <article className="prose max-w-none prose-slate dark:prose-invert">
        <h1>Điều khoản Dịch vụ</h1>
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
      </article>
    </section>
  );
}
