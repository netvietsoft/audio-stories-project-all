import 'models.dart';

/// Nội dung demo NovelVerse (handoff 04). Cover trỏ tới assets/covers/* —
/// nếu chưa có ảnh, UI tự render placeholder gradient (xem CoverImage).
abstract final class Demo {
  static const books = <Book>[
    Book(id: 'rom_3', title: "The Billionaire's First Glance", author: 'A. Vermont', genre: 'Romance', cover: 'assets/covers/rom_3.png', rating: '4.8', reads: '8.7M', label: StoryLabel(text: 'HOT', color: '#E4572E'), chapters: 210),
    Book(id: 'wolf_0', title: 'The Lycan King', author: 'M. Stone', genre: 'Fantasy', cover: 'assets/covers/wolf_0.png', rating: '4.9', reads: '12.1M', label: StoryLabel(text: 'TOP', color: '#2E86AB')),
    Book(id: 'rom_2', title: "Rose Rain's Revenge", author: 'L. Hart', genre: 'Drama', cover: 'assets/covers/rom_2.png', rating: '4.7', reads: '5.3M', label: StoryLabel(text: 'NEW', color: '#3AAF64')),
    Book(id: 'wolf_2', title: 'The Beast and the Blessed', author: 'K. Wilde', genre: 'Fantasy', cover: 'assets/covers/wolf_2.png', rating: '4.6', reads: '3.9M'),
    Book(id: 'love_0', title: "The CEO's Ex-Wife", author: 'S. Lane', genre: 'Romance', cover: 'assets/covers/love_0.png', rating: '4.8', reads: '9.2M', label: StoryLabel(text: 'VIP', color: '#8E44AD')),
    Book(id: 'wolf_3', title: 'The Last Forbidden Bond', author: 'R. Moon', genre: 'Werewolf', cover: 'assets/covers/wolf_3.png', rating: '4.5', reads: '2.7M'),
    Book(id: 'love_4', title: 'Her Forbidden Affair', author: 'E. Frost', genre: 'Romance', cover: 'assets/covers/love_4.png', rating: '4.7', reads: '6.4M'),
    Book(id: 'love_2', title: 'Forceful Marriage', author: 'J. Reed', genre: 'Drama', cover: 'assets/covers/love_2.png', rating: '4.6', reads: '4.1M', label: StoryLabel(text: 'HOT', color: '#E4572E')),
  ];

  /// 100 chương: 1–10 free; chương 24 = current; bội số 25 = VIP; còn lại = coin.
  static List<Chapter> chaptersFor(Book b) => List.generate(100, (i) {
        final n = i + 1;
        final state = n <= 10
            ? ChapterState.free
            : n == 24
                ? ChapterState.current
                : n % 25 == 0
                    ? ChapterState.vip
                    : ChapterState.coin;
        return Chapter(n: n, title: _chapTitle(n), state: state);
      });

  static String _chapTitle(int n) {
    const t = ['The Contract', 'First Light', 'A Dangerous Game', 'Whispers', 'The Offer',
      'Broken Vows', 'Midnight', 'The Reveal', 'Crossroads', 'Storm'];
    return t[n % t.length];
  }

  static const songs = <Song>[
    Song(cover: 'assets/covers/mus_0.png', title: 'Anh Về Với Em', author: 'Tuấn Vũ & Như Mai', url: 'audio/s0.mp3'),
    Song(cover: 'assets/covers/mus_2.png', title: 'Bài Tango Cho Em', author: 'Tuấn Vũ', url: 'audio/s2.mp3'),
    Song(cover: 'assets/covers/mus_5.png', title: 'Chiều Tím', author: 'Tuấn Vũ', url: 'audio/s5.mp3'),
    Song(cover: 'assets/covers/mus_6.png', title: 'Cho Tôi Được Một Lần', author: 'Tuấn Vũ', url: 'audio/s6.mp3'),
    Song(cover: 'assets/covers/mus_9.png', title: 'Đà Lạt Hoàng Hôn', author: 'Tuấn Vũ', url: 'audio/s9.mp3'),
    Song(cover: 'assets/covers/mus_12.png', title: 'Định Mệnh', author: 'Tuấn Vũ', url: 'audio/s12.mp3'),
  ];

  static const charts = <Chart>[
    Chart(title: 'Top 100 Remix Việt', cover: 'assets/covers/top_0.png'),
    Chart(title: 'Top 100 Nhạc Hàn', cover: 'assets/covers/top_1.png'),
    Chart(title: 'Top 100 Rap Việt', cover: 'assets/covers/top_2.png'),
    Chart(title: 'Top 100 Nhạc Hoa', cover: 'assets/covers/top_3.png'),
    Chart(title: 'Top 100 Nhạc Trẻ', cover: 'assets/covers/top_4.png'),
    Chart(title: 'Top 100 Trữ Tình', cover: 'assets/covers/top_5.png'),
  ];

  static const coinPacks = <CoinPack>[
    CoinPack(coins: '200', price: '\$1.99', label: 'Starter'),
    CoinPack(coins: '1,100', price: '\$9.99', bonus: '+10%', label: 'Popular'),
    CoinPack(coins: '6,000', price: '\$49.99', bonus: '+20%', label: 'Best Value'),
    CoinPack(coins: '13,000', price: '\$99.99', bonus: '+30%', label: 'Whale'),
  ];

  static const plans = <Plan>[
    Plan(name: 'VIP Annual', price: '\$99 / yr'),
    Plan(name: 'VIP Monthly', price: '\$14.99 / mo', popular: true),
    Plan(name: 'VIP Weekly', price: '\$4.99 / wk'),
    Plan(name: 'Starter', price: '\$0.99 / day'),
  ];

  static const gifts = <Gift>[
    Gift(name: 'Coin', coins: 10, emoji: '🪙'),
    Gift(name: 'Bouquet', coins: 20, emoji: '💐'),
    Gift(name: 'Coffee', coins: 30, emoji: '☕'),
    Gift(name: 'Pen', coins: 40, emoji: '🖊️'),
    Gift(name: 'Diamond', coins: 100, emoji: '💎'),
    Gift(name: 'Crown', coins: 500, emoji: '👑'),
  ];

  static const genres = ['Romance', 'Fantasy', 'Werewolf', 'Drama', 'Mystery', 'Sci-Fi', 'Horror', 'Comedy'];
}
