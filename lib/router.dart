import 'package:go_router/go_router.dart';

import 'screens/account/account_screens.dart';
import 'screens/app_shell.dart';
import 'screens/auth/login_screen.dart';
import 'screens/audio/album_detail_screen.dart';
import 'screens/audio/audiobook_player_screen.dart';
import 'screens/audio/favourites_screen.dart';
import 'screens/audio/music_player_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'screens/money/coin_store_screen.dart';
import 'screens/money/subscription_screen.dart';
import 'screens/money/wallet_screen.dart';
import 'screens/novel/book_detail_screen.dart';
import 'screens/novel/for_you_screen.dart';
import 'screens/novel/reader_screen.dart';
import 'screens/splash_screen.dart';

/// Điều hướng NovelVerse. Splash → Home (shell có bottom nav). Các màn chi tiết
/// (book detail, reader, player, coin store...) push lên trên.
final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
    GoRoute(path: '/home', builder: (_, __) => const AppShell()),
    GoRoute(
      path: '/book/:id',
      builder: (_, s) => BookDetailScreen(bookId: s.pathParameters['id']!),
    ),
    GoRoute(
      path: '/reader/:id',
      builder: (_, s) => ReaderScreen(
        bookId: s.pathParameters['id']!,
        initialChapter: int.tryParse(s.uri.queryParameters['ch'] ?? ''),
      ),
    ),
    GoRoute(path: '/for-you', builder: (_, __) => const ForYouScreen()),
    GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingScreen()),
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/player', builder: (_, __) => const MusicPlayerScreen()),
    GoRoute(path: '/audiobook', builder: (_, __) => const AudiobookPlayerScreen()),
    GoRoute(path: '/coins', builder: (_, __) => const CoinStoreScreen()),
    GoRoute(path: '/subscription', builder: (_, __) => const SubscriptionScreen()),
    GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
    GoRoute(path: '/favourites', builder: (_, __) => const FavouritesScreen()),
    GoRoute(
      path: '/album/:i',
      builder: (_, s) => AlbumDetailScreen(index: int.tryParse(s.pathParameters['i'] ?? '0') ?? 0),
    ),
    GoRoute(path: '/edit-profile', builder: (_, __) => const EditProfileScreen()),
    GoRoute(path: '/language', builder: (_, __) => const LanguageSettingsScreen()),
    GoRoute(path: '/content-settings', builder: (_, __) => const ContentSettingsScreen()),
    GoRoute(path: '/claim-copyright', builder: (_, __) => const ClaimCopyrightScreen()),
    GoRoute(path: '/become-author', builder: (_, __) => const BecomeAuthorScreen()),
  ],
);
