import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/mappers/book_mapper.dart';

void main() {
  test('maps label object from JSON', () {
    final b = BookMapper.fromJson({'id': 's1', 'title': 'X', 'label': {'text': 'HOT', 'color': '#E4572E'}});
    expect(b.label, isNotNull);
    expect(b.label!.text, 'HOT');
    expect(b.label!.color, '#E4572E');
  });

  test('null label => no badge', () {
    final b = BookMapper.fromJson({'id': 's2', 'title': 'Y'});
    expect(b.label, isNull);
  });
}
