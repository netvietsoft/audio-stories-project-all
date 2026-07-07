import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelverse/data/offline/file_store.dart';

void main() {
  late Directory tmp;
  late FileStore fs;
  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('fs_test');
    fs = FileStore(tmp);
  });
  tearDown(() async { if (tmp.existsSync()) await tmp.delete(recursive: true); });

  test('writeAudioBytes tạo file, audioExists true, size đúng, deleteStory xoá', () async {
    expect(await fs.audioExists('s1', 'c1'), false);
    final n = await fs.writeAudioBytes('s1', 'c1', List.filled(2048, 7));
    expect(n, 2048);
    expect(await fs.audioExists('s1', 'c1'), true);
    expect(await fs.audioSize('s1', 'c1'), 2048);
    expect(fs.audioPath('s1', 'c1').endsWith('audio/s1/c1.mp3'.replaceAll('/', Platform.pathSeparator)), true);
    await fs.deleteStory('s1');
    expect(await fs.audioExists('s1', 'c1'), false);
  });
}
