import { buildFfmpegArgs } from '../hls-transcode.service';

describe('buildFfmpegArgs', () => {
  const args = buildFfmpegArgs({
    input: '/tmp/in.mp3',
    outDir: '/tmp/out',
    keyInfoFile: '/tmp/out/keyinfo',
    bitrate: '128k',
    segmentSeconds: 10,
  });

  const valueAfter = (flag: string) => args[args.indexOf(flag) + 1];

  it('encodes AAC (LC) audio', () => {
    expect(args).toContain('-c:a');
    expect(valueAfter('-c:a')).toBe('aac');
  });

  it('applies the configured bitrate', () => {
    expect(valueAfter('-b:a')).toBe('128k');
  });

  it('applies the configured segment length', () => {
    expect(valueAfter('-hls_time')).toBe('10');
  });

  it('uses the key info file for AES-128', () => {
    expect(args).toContain('-hls_key_info_file');
    expect(valueAfter('-hls_key_info_file')).toBe('/tmp/out/keyinfo');
  });

  it('produces MPEG-TS VOD segments', () => {
    expect(valueAfter('-hls_segment_type')).toBe('mpegts');
    expect(valueAfter('-hls_playlist_type')).toBe('vod');
  });

  it('strips video (audio-only)', () => {
    expect(args).toContain('-vn');
  });

  it('passes the input path as a discrete arg (no shell interpolation)', () => {
    expect(args).toContain('/tmp/in.mp3');
    args.forEach((a) => expect(typeof a).toBe('string'));
  });

  it('writes the playlist + segment pattern under the output dir', () => {
    expect(args).toContain('/tmp/out/index.m3u8');
    expect(valueAfter('-hls_segment_filename')).toBe('/tmp/out/seg_%03d.ts');
  });

  it('honours custom bitrate/segment values', () => {
    const a = buildFfmpegArgs({
      input: '/i.mp3',
      outDir: '/o',
      keyInfoFile: '/o/keyinfo',
      bitrate: '96k',
      segmentSeconds: 6,
    });
    expect(a[a.indexOf('-b:a') + 1]).toBe('96k');
    expect(a[a.indexOf('-hls_time') + 1]).toBe('6');
  });
});
