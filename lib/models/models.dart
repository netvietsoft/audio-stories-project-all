/// Data shapes NovelVerse (handoff 04-data-model). Dùng cho cả dữ liệu `Demo` tĩnh
/// (mặc định) lẫn dữ liệu backend (mapper trong `lib/data/mappers/`, bật bằng
/// `--dart-define=USE_BACKEND=true`).

enum ChapterState { free, coin, vip, current }

class StoryLabel {
  const StoryLabel({required this.text, required this.color, this.icon});
  final String text;
  final String color; // hex, e.g. "#E4572E"
  final String? icon;
}

class Book {
  const Book({
    required this.id,
    required this.title,
    required this.author,
    required this.genre,
    required this.cover,
    this.trope = '',
    this.rating = '4.8',
    this.reads = '1.2M',
    this.status = 'Ongoing',
    this.chapters = 100,
    this.label,
    this.subtitle = '',
    this.synopsis = '',
    this.unlockPrice = 0,
    this.discountPercent = 0,
    this.categoriesLabel = '',
    this.uuid,
  });

  final String id, title, author, genre, cover, trope, rating, reads, status;

  /// UUID thật của truyện từ BE (Book.id là slug). Null với dữ liệu Demo.
  final String? uuid;
  final int chapters;
  final StoryLabel? label;

  /// Chuỗi thể loại gộp tối đa 3 mục ("Romance · Revenge · Rebirth") — cho list search.
  final String categoriesLabel;

  /// Tiêu đề phụ / dịch (hiển thị italic dưới tên truyện). Rỗng = ẩn.
  final String subtitle;

  /// Tóm tắt nội dung (map từ BE `description`). Rỗng = ẩn khối synopsis.
  final String synopsis;

  /// Giá mở khoá cả bộ (Pulse) + % giảm — map từ BE. 0 = miễn phí / ẩn bundle.
  final int unlockPrice, discountPercent;
}

class Chapter {
  const Chapter({required this.n, required this.title, required this.state, this.price = 15, this.id = '', this.hlsUrl = '', this.hasAudio = false});

  /// ID chương ở backend (rỗng với dữ liệu Demo). Cần để gọi
  /// `/chapters/:id/public` (nội dung) và `/chapters/:id/audio`.
  final String id;
  final int n;
  final String title;
  final ChapterState state;
  final int price;

  /// URL m3u8 (HLS Cloudflare) nếu đã transcode xong — ưu tiên phát.
  final String hlsUrl;

  /// True nếu chương có audiobook (audioDuration>0 hoặc có hlsUrl).
  final bool hasAudio;
}

class Song {
  const Song({required this.cover, required this.title, required this.author, this.reads = '3.2M', this.url = '', this.hlsUrl = ''});
  final String cover, title, author, reads, url;

  /// URL m3u8 (HLS trên Cloudflare) — ưu tiên phát nếu có (stream + preload).
  final String hlsUrl;
}

class Chart {
  const Chart({required this.title, required this.cover, this.songs = const []});
  final String title, cover;
  final List<Song> songs;
}

/// Thể loại truyện (nguồn: BE `/stories/categories`, theo ngôn ngữ). Lọc explore qua [id].
class Category {
  const Category({required this.id, required this.name, required this.slug});
  final int id;
  final String name, slug;
}

class CoinPack {
  const CoinPack({required this.coins, required this.price, this.bonus, this.label});
  final String coins, price;
  final String? bonus, label; // bonus "+10%", label "Popular"
}

class Plan {
  const Plan({required this.name, required this.price, this.popular = false});
  final String name, price;
  final bool popular;
}

class Gift {
  const Gift({required this.name, required this.coins, required this.emoji});
  final String name, emoji;
  final int coins;
}

/// Người dùng đăng nhập (map từ `/auth/me`). `pulseBalance` = "coin" phía app.
class AppUser {
  const AppUser({
    required this.email,
    required this.name,
    this.avatarUrl,
    this.pulseBalance = 0,
    this.vipTier = 0,
    this.role,
  });

  final String email;
  final String name;
  final String? avatarUrl;
  final int pulseBalance;
  final int vipTier;
  final String? role;

  bool get isVip => vipTier > 0;
}
