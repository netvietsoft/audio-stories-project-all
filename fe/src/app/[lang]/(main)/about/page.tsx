import type { Metadata } from "next";

const SITE_NAME = "AudioTruyen";

export function generateMetadata(): Metadata {
  return {
    title: `Giới thiệu | ${SITE_NAME}`,
    description:
      "Giới thiệu về tầm nhìn, sứ mệnh và cam kết của nền tảng nghe truyện audio, hỗ trợ trải nghiệm giải trí mọi lúc mọi nơi.",
  };
}

export default function AboutPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 py-6 md:py-8">
      <article className="prose max-w-none prose-slate dark:prose-invert">
        <h1>Giới thiệu về AudioTruyen</h1>
        <p>
          AudioTruyen là nền tảng truyện âm thanh được xây dựng với định hướng chuyển hóa thế giới truyện chữ
          thành trải nghiệm nghe sống động, thuận tiện và bền vững cho cộng đồng yêu truyện. Chúng tôi tin rằng
          nội dung hay cần được tiếp cận theo nhiều cách linh hoạt hơn, phù hợp với nhịp sống hiện đại.
        </p>

        <h2>Tầm nhìn</h2>
        <p>
          Trở thành nền tảng nghe truyện audio đáng tin cậy hàng đầu tại Việt Nam, nơi người dùng có thể tiếp cận
          kho nội dung đa thể loại với chất lượng ổn định, tối ưu trên nhiều thiết bị và phù hợp với nhiều bối cảnh
          sử dụng trong ngày.
        </p>

        <h2>Sứ mệnh</h2>
        <p>
          Sứ mệnh của chúng tôi là giúp người dùng giải trí mọi lúc mọi nơi bằng trải nghiệm nghe truyện thuận tiện,
          từ khi lái xe, trước giờ đi ngủ đến lúc làm việc nhà hoặc di chuyển. AudioTruyen theo đuổi cách thiết kế
          sản phẩm tập trung vào tính dễ dùng, tốc độ và khả năng đồng bộ liên tục.
        </p>

        <h2>Giá trị cốt lõi và tính năng nổi bật</h2>

        <h3>1. Kho truyện phong phú, cập nhật liên tục</h3>
        <p>
          Nền tảng tập hợp nhiều thể loại truyện khác nhau nhằm đáp ứng nhu cầu đa dạng của cộng đồng người nghe,
          bao gồm các nội dung phổ biến và xu hướng mới. Dữ liệu được tổ chức khoa học để người dùng dễ tra cứu,
          khám phá và theo dõi truyện yêu thích.
        </p>

        <h3>2. Chất lượng âm thanh ổn định</h3>
        <p>
          Chúng tôi ưu tiên tiêu chuẩn phát âm rõ ràng, âm lượng cân bằng và trải nghiệm nghe mượt mà để người dùng
          có thể thưởng thức nội dung trong thời gian dài mà vẫn thoải mái.
        </p>

        <h3>3. Tối ưu tốc độ tải trang và hiệu năng</h3>
        <p>
          AudioTruyen áp dụng các kỹ thuật hiện đại như PWA, cơ chế caching và tối ưu tài nguyên để rút ngắn thời
          gian phản hồi, giảm gián đoạn khi truy cập và nâng cao trải nghiệm tổng thể trên cả điện thoại lẫn máy tính.
        </p>

        <h3>4. Lưu lịch sử nghe thông minh đa thiết bị</h3>
        <p>
          Hệ thống lưu lại tiến độ nghe và lịch sử truy cập của người dùng theo tài khoản, giúp đồng bộ xuyên suốt
          giữa các thiết bị khác nhau, hỗ trợ tiếp tục nghe đúng vị trí mong muốn.
        </p>

        <h2>Cam kết với cộng đồng</h2>
        <p>
          Chúng tôi xem phản hồi của người dùng là cơ sở quan trọng cho mọi quyết định phát triển sản phẩm. AudioTruyen
          cam kết liên tục lắng nghe, cải tiến tính năng, nâng cao chất lượng vận hành và từng bước hoàn thiện
          hệ sinh thái nội dung theo hướng minh bạch, an toàn và bền vững.
        </p>

        <ul>
          <li>Liên tục nâng cấp hạ tầng để cải thiện tốc độ và độ ổn định.</li>
          <li>Tăng cường quy trình kiểm duyệt nội dung và trải nghiệm bình luận văn minh.</li>
          <li>Hoàn thiện hệ thống hỗ trợ người dùng và tiếp nhận phản hồi đa kênh.</li>
        </ul>

        <p>
          Trân trọng cảm ơn cộng đồng đã đồng hành cùng AudioTruyen. Sự tin tưởng của bạn là động lực để chúng tôi
          cải thiện hệ thống mỗi ngày.
        </p>
      </article>
    </section>
  );
}
