import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';
import 'package:novelverse/data/repositories/stories_repository.dart';
import 'package:novelverse/data/share_links.dart';

class _FakeApi extends ApiClient {
  String? lastPath;
  Object? lastBody;
  @override
  Future<dynamic> post(String path, {Object? body}) async {
    lastPath = path; lastBody = body;
    return const {};
  }
}

void main() {
  test('giftPulse: đúng path UUID + body amount/message/chapterId', () async {
    final api = _FakeApi();
    final repo = StoriesRepository(api);
    await repo.giftPulse('uuid-123', amount: 30, message: '☕ Coffee', chapterId: 'ch9');
    expect(api.lastPath, '/stories/uuid-123/gift');
    expect(api.lastBody, {'amount': 30, 'message': '☕ Coffee', 'chapterId': 'ch9'});
  });

  test('buildChapterWebUrl: canonical không kèm lang', () {
    expect(buildChapterWebUrl('tien-nghich', 12), 'https://dreamtap.me/story/tien-nghich/chuong-12');
  });
}
