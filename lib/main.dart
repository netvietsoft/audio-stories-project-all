import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:dio/dio.dart';

import 'l10n/gen/app_localizations.dart';

import 'api/api_client.dart';
import 'api/token_store.dart';
import 'data/cache/json_cache.dart';
import 'data/reader/reader_store.dart';
import 'data/offline/file_store.dart';
import 'data/offline/offline_store.dart';
import 'data/offline/connectivity_service.dart';
import 'data/offline/download_manager.dart';
import 'data/repositories/audio_repository.dart';
import 'data/repositories/banners_repository.dart';
import 'data/repositories/categories_repository.dart';
import 'data/repositories/comments_repository.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/history_repository.dart';
import 'data/repositories/music_repository.dart';
import 'data/repositories/stories_repository.dart';
import 'router.dart';
import 'state/app_state.dart';
import 'state/auth_notifier.dart';
import 'state/music_notifier.dart';
import 'state/stories_notifier.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  // Cần cho gọi plugin (shared_preferences) trước runApp.
  WidgetsFlutterBinding.ensureInitialized();
  // Khóa app CHỈ ở chế độ DỌC (portrait) — không cho xoay ngang.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  final appState = AppState();
  // Nạp state đã lưu trước frame đầu → theme/mode/coin đúng ngay, không nháy.
  await appState.init();

  // Tầng dữ liệu (data layer). 1 ApiClient dùng chung cho mọi repository.
  // JsonCache (prefs) cho stale-while-revalidate danh sách stories/music.
  final prefs = await SharedPreferences.getInstance();
  final cache = JsonCache(prefs);
  final readerStore = ReaderStore(prefs);
  final apiClient = ApiClient();

  // Offline: Hive + FileStore + store + connectivity + download manager.
  await Hive.initFlutter();
  final fileStore = await FileStore.open();
  final offlineStore = OfflineStore(
    downloads: await Hive.openBox('downloads'),
    chapters: await Hive.openBox('chapters'),
    storyMeta: await Hive.openBox('storyMeta'),
    files: fileStore,
  );
  final connectivity = ConnectivityService();
  await connectivity.start();

  final storiesRepo = StoriesRepository(apiClient, cache, offlineStore, connectivity);
  final musicRepo = MusicRepository(apiClient, cache);
  final categoriesRepo = CategoriesRepository(apiClient, cache);
  final bannersRepo = BannersRepository(apiClient);
  final historyRepo = HistoryRepository(apiClient);
  final commentsRepo = CommentsRepository(apiClient);
  final audioRepo = AudioRepository(apiClient);
  final authRepo = AuthRepository(apiClient, TokenStore());
  // Auto-refresh access token khi 401 (ApiClient gọi lại refresh của auth).
  apiClient.refreshCallback = authRepo.refresh;

  final dio = Dio();
  final downloadManager = DownloadManager(
    storiesRepo, audioRepo, offlineStore,
    downloader: (url, storyId, chapterId) async {
      final path = fileStore.audioPath(storyId, chapterId);
      await dio.download(url, path);
      return File(path).lengthSync();
    },
  );

  // Cho AppState lấy token để gắn Bearer vào request HLS (key/segment trả phí).
  appState.tokenProvider = () => apiClient.accessToken;

  final authNotifier = AuthNotifier(authRepo);
  // Khôi phục phiên trong nền (splash che ~1.1s); không chặn boot.
  authNotifier.restore();

  runApp(NovelVerseApp(
    appState: appState,
    storiesRepo: storiesRepo,
    musicRepo: musicRepo,
    categoriesRepo: categoriesRepo,
    bannersRepo: bannersRepo,
    historyRepo: historyRepo,
    commentsRepo: commentsRepo,
    audioRepo: audioRepo,
    authNotifier: authNotifier,
    offlineStore: offlineStore,
    connectivity: connectivity,
    downloadManager: downloadManager,
    readerStore: readerStore,
  ));
}

class NovelVerseApp extends StatelessWidget {
  const NovelVerseApp({
    super.key,
    required this.appState,
    required this.storiesRepo,
    required this.musicRepo,
    required this.categoriesRepo,
    required this.bannersRepo,
    required this.historyRepo,
    required this.commentsRepo,
    required this.audioRepo,
    required this.authNotifier,
    required this.offlineStore,
    required this.connectivity,
    required this.downloadManager,
    required this.readerStore,
  });

  final AppState appState;
  final StoriesRepository storiesRepo;
  final MusicRepository musicRepo;
  final CategoriesRepository categoriesRepo;
  final BannersRepository bannersRepo;
  final HistoryRepository historyRepo;
  final CommentsRepository commentsRepo;
  final AudioRepository audioRepo;
  final AuthNotifier authNotifier;
  final OfflineStore offlineStore;
  final ConnectivityService connectivity;
  final DownloadManager downloadManager;
  final ReaderStore readerStore;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: appState),
        ChangeNotifierProvider.value(value: authNotifier),
        Provider.value(value: storiesRepo),
        Provider.value(value: musicRepo),
        Provider.value(value: categoriesRepo),
        Provider.value(value: bannersRepo),
        Provider.value(value: historyRepo),
        Provider.value(value: commentsRepo),
        Provider.value(value: audioRepo),
        Provider.value(value: offlineStore),
        ChangeNotifierProvider.value(value: connectivity),
        ChangeNotifierProvider.value(value: downloadManager),
        Provider.value(value: readerStore),
        ChangeNotifierProvider(create: (_) => StoriesNotifier(storiesRepo)),
        ChangeNotifierProvider(create: (_) => MusicNotifier(musicRepo)),
      ],
      // Chỉ MaterialApp lắng nghe themeMode của AppState (select) để rebuild khi đổi theme.
      child: Consumer<AppState>(
        builder: (context, app, _) => MaterialApp.router(
          title: 'NovelVerse',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: app.themeMode,
          // Ngôn ngữ HIỂN THỊ (i18n) — theo AppState.uiLang; đổi là dịch lại UI.
          locale: Locale(app.uiLang),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          routerConfig: appRouter,
        ),
      ),
    );
  }
}
