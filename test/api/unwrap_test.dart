import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/api/api_client.dart';

void main() {
  group('unwrapList', () {
    test('single-wrap {data:[...]} → list', () {
      expect(unwrapList({'data': [1, 2, 3], 'meta': {'page': 1}}), [1, 2, 3]);
    });
    test('double-wrap {data:{data:[...],meta}} → list', () {
      expect(
        unwrapList({
          'data': {'data': [1, 2], 'meta': {'page': 1}},
          'meta': {'requestId': 'r'}
        }),
        [1, 2],
      );
    });
    test('bare list → itself', () {
      expect(unwrapList([9]), [9]);
    });
    test('non-list → []', () {
      expect(unwrapList({'foo': 'bar'}), const []);
      expect(unwrapList(null), const []);
    });
  });

  group('unwrapMeta', () {
    test('single-wrap → pagination meta at top level', () {
      final m = unwrapMeta({
        'data': [1, 2],
        'meta': {'total': 100, 'page': 1, 'lastPage': 5, 'requestId': 'r'}
      });
      expect(m?['total'], 100);
      expect(m?['page'], 1);
      expect(m?['lastPage'], 5);
    });

    test('double-wrap (old) → pagination meta one level down', () {
      final m = unwrapMeta({
        'data': {
          'data': [1, 2],
          'meta': {'total': 100, 'page': 1, 'lastPage': 5}
        },
        'meta': {'requestId': 'r'}
      });
      expect(m?['total'], 100);
      expect(m?['lastPage'], 5);
      // must NOT return the outer {requestId} meta
      expect(m?.containsKey('requestId'), false);
    });

    test('no meta sibling → null', () {
      expect(unwrapMeta({'data': [1, 2]}), isNull);
    });

    test('bare list / non-map → null', () {
      expect(unwrapMeta([1, 2]), isNull);
      expect(unwrapMeta(null), isNull);
    });

    test('meta not a map → null', () {
      expect(unwrapMeta({'data': [1], 'meta': 'nope'}), isNull);
    });
  });
}
