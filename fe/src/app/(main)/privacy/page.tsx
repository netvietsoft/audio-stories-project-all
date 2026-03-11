import type { Metadata } from "next";

const SITE_NAME = "AudioTruyen";

export function generateMetadata(): Metadata {
  return {
    title: `Chính sách bảo mật | ${SITE_NAME}`,
    description:
      "Chính sách bảo mật mô tả cách thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu người dùng trên nền tảng nghe truyện audio.",
  };
}

export default function PrivacyPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 py-6 md:py-8">
      <article className="prose max-w-none prose-slate dark:prose-invert">
        <h1>Chính sách Bảo mật</h1>
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
      </article>
    </section>
  );
}
