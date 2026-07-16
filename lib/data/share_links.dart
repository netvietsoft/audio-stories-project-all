import '../api/api_env.dart';

/// Link web đọc chương — đúng canonical của web (KHÔNG kèm segment ngôn ngữ):
/// https://dreamtap.me/story/{slug}/chuong-{N}
String buildChapterWebUrl(String storySlug, int chapterNumber) =>
    '${ApiEnv.webBaseUrl}/story/$storySlug/chuong-$chapterNumber';
