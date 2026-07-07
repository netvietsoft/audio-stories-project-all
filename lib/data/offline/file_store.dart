import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Quản lý file audio offline dưới `<baseDir>/audio/<storyId>/<chapterId>.mp3`.
/// Nhận [baseDir] để test inject thư mục tạm.
class FileStore {
  FileStore(this._base);
  final Directory _base;

  static Future<FileStore> open() async {
    final docs = await getApplicationDocumentsDirectory();
    return FileStore(Directory('${docs.path}/offline'));
  }

  File _audio(String storyId, String chapterId) {
    final sep = Platform.pathSeparator;
    return File('${_base.path}${sep}audio${sep}$storyId${sep}$chapterId.mp3');
  }

  String audioPath(String storyId, String chapterId) => _audio(storyId, chapterId).path;

  Future<bool> audioExists(String storyId, String chapterId) =>
      _audio(storyId, chapterId).exists();

  Future<int> writeAudioBytes(String storyId, String chapterId, List<int> bytes) async {
    final f = _audio(storyId, chapterId);
    await f.parent.create(recursive: true);
    await f.writeAsBytes(bytes, flush: true);
    return bytes.length;
  }

  Future<int> audioSize(String storyId, String chapterId) async {
    final f = _audio(storyId, chapterId);
    return await f.exists() ? f.length() : 0;
  }

  Future<void> deleteStory(String storyId) async {
    final sep = Platform.pathSeparator;
    final dir = Directory('${_base.path}${sep}audio${sep}$storyId');
    if (await dir.exists()) await dir.delete(recursive: true);
  }
}
