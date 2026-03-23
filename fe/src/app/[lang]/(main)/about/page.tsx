interface PageProps {
  params: Promise<{ lang: string }>;
}

const content = {
  vi: {
    title: "Giới thiệu về AudioTruyen",
    body: (
      <>
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
      </>
    ),
  },
  en: {
    title: "About AudioTruyen",
    body: (
      <>
        <p>
          AudioTruyen is an audio storytelling platform built to transform the world of written stories into an immersive,
          convenient, and sustainable listening experience for the story-loving community. We believe great content
          should be accessible in more flexible ways that fit modern lifestyles.
        </p>

        <h2>Vision</h2>
        <p>
          To become a leading and trusted audio storytelling platform in Vietnam, where users can access a multi-genre content
          library with stable quality, optimized for multiple devices and suitable for many everyday listening contexts.
        </p>

        <h2>Mission</h2>
        <p>
          Our mission is to help users enjoy entertainment anytime, anywhere through a convenient listening experience,
          from driving and bedtime to doing household tasks or commuting. AudioTruyen follows a product design approach
          focused on usability, speed, and continuous synchronization.
        </p>

        <h2>Core Values and Highlights</h2>

        <h3>1. Rich Library, Continuously Updated</h3>
        <p>
          The platform brings together many story genres to meet diverse listener needs, including popular content and
          emerging trends. Content is organized systematically so users can easily search, discover, and follow favorite stories.
        </p>

        <h3>2. Stable Audio Quality</h3>
        <p>
          We prioritize clear pronunciation, balanced volume, and smooth playback so users can enjoy content comfortably
          over long listening sessions.
        </p>

        <h3>3. Optimized Speed and Performance</h3>
        <p>
          AudioTruyen applies modern techniques such as PWA, caching mechanisms, and asset optimization to shorten
          response time, reduce interruptions, and improve overall experience on both mobile and desktop.
        </p>

        <h3>4. Smart Multi-Device Listening History</h3>
        <p>
          The system stores listening progress and user history by account, enabling seamless cross-device sync and
          helping users continue exactly where they left off.
        </p>

        <h2>Commitment to the Community</h2>
        <p>
          We consider user feedback a key foundation for every product decision. AudioTruyen is committed to continuous
          listening, feature improvements, operational quality upgrades, and gradually completing a transparent, safe,
          and sustainable content ecosystem.
        </p>

        <ul>
          <li>Continuously upgrading infrastructure to improve speed and stability.</li>
          <li>Strengthening content moderation and promoting respectful community discussion.</li>
          <li>Improving user support and multi-channel feedback intake.</li>
        </ul>

        <p>
          We sincerely thank our community for accompanying AudioTruyen. Your trust is our motivation to improve the
          platform every day.
        </p>
      </>
    ),
  },
} as const;

export default async function AboutPage({ params }: PageProps) {
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
