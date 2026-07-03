import { MusicContentType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedSingle = {
  title: string;
  artist: string;
  description: string;
  duration: number;
  tags: string[];
};

type SeedPlaylist = {
  title: string;
  artist: string;
  description: string;
  tags: string[];
  size: number;
};

const SINGLE_SEED: SeedSingle[] = [
  { title: 'Chill Vibes Lofi', artist: 'Lofi Girl', description: 'Nhac lofi thu gian hoc tap', duration: 180, tags: ['lofi', 'chill', 'study'] },
  { title: 'Rainy Night Piano', artist: 'John Doe', description: 'Tieng dan piano trong dem mua', duration: 250, tags: ['piano', 'instrumental'] },
  { title: 'Cyberpunk City', artist: 'Synthwave Boy', description: 'Nhac dien tu soi dong', duration: 210, tags: ['synthwave', 'electronic'] },
  { title: 'Morning Coffee', artist: 'Acoustic Band', description: 'Nhac acoustic buoi sang som', duration: 195, tags: ['acoustic', 'morning'] },
  { title: 'Epic Mountain', artist: 'Orchestra Pro', description: 'Nhac thinh phong hung trang', duration: 320, tags: ['epic', 'orchestra'] },
  { title: 'Sunset Drive', artist: 'Retro Master', description: 'Nhac lofi chill luc hoang hon', duration: 240, tags: ['lofi', 'retro'] },
  { title: 'Deep Sleep', artist: 'Ambient Sounds', description: 'Nhac ambient de ngu dinh tam', duration: 300, tags: ['ambient', 'sleep'] },
  { title: 'Workout Beats', artist: 'DJ Gym', description: 'Nhac tap gym soi dong', duration: 215, tags: ['gym', 'beat'] },
  { title: 'Focus Energy', artist: 'Dr. Focus', description: 'Am thanh song nao tap trung', duration: 400, tags: ['focus', 'binaural'] },
  { title: 'Summer Pop', artist: 'Idol Pop', description: 'Bai hat pop soi dong cho mua he', duration: 185, tags: ['pop', 'summer'] },
  { title: 'Sad Song', artist: 'Broken Lips', description: 'Mot bai nhac buon cho ngay mua', duration: 220, tags: ['sad', 'pop', 'vocal'] },
  { title: 'Healing Water', artist: 'Nature Spirit', description: 'Tieng suoi roc rach chua lanh', duration: 280, tags: ['nature', 'healing'] },
  { title: 'Rock The Stage', artist: 'Metal Head', description: 'Rock day nang luong', duration: 210, tags: ['rock', 'metal'] },
  { title: 'Jazz Club', artist: 'Saxophone Man', description: 'Dem nhac jazz nhe nhang', duration: 260, tags: ['jazz', 'saxophone'] },
  { title: 'K-pop Dance', artist: 'K-Stars', description: 'Nhip dieu manh me cho dance', duration: 190, tags: ['kpop', 'dance'] },
];

const PLAYLIST_SEED: SeedPlaylist[] = [
  { title: 'Top Lofi De Hoc Tap', artist: 'He Thong', description: 'Playlist lofi giup tap trung', tags: ['lofi', 'study', 'playlist'], size: 5 },
  { title: 'Nhac Acoustic Nhe Nhang', artist: 'He Thong', description: 'Nhung bai hat moc mac cuoi tuan', tags: ['acoustic', 'guitar', 'playlist'], size: 4 },
  { title: 'Top Hits Tuan Nay', artist: 'He Thong', description: 'Cac bai hat co luot nghe cao', tags: ['top', 'hits', 'playlist'], size: 6 },
];

const toSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const getUniqueSlug = (raw: string, used: Set<string>) => {
  const base = toSlug(raw) || `music-${Date.now()}`;
  let index = 0;

  while (true) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    index += 1;
  }
};

async function main() {
  console.log('Bat dau seed du lieu test cho phan Music...');

  const users = await prisma.user.findMany({ take: 5 });
  if (users.length === 0) {
    console.warn('Khong tim thay user, vui long chay seed chinh truoc.');
    return;
  }

  const existingSlugs = await prisma.music.findMany({
    select: { slug: true },
  });
  const usedSlugs = new Set(existingSlugs.map((item) => item.slug));

  const mainUser = users[0];
  const singles = [] as Awaited<ReturnType<typeof prisma.music.create>>[];

  for (let i = 0; i < SINGLE_SEED.length; i += 1) {
    const item = SINGLE_SEED[i];

    const created = await prisma.music.create({
      data: {
        title: item.title,
        slug: getUniqueSlug(item.title, usedSlugs),
        artist: item.artist,
        description: item.description,
        tags: item.tags,
        thumbnailUrl: `https://picsum.photos/seed/music_single_${i}/600/600`,
        audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 5) + 1}.mp3`,
        audioDuration: item.duration,
        contentType: MusicContentType.single,
        playlistTrackIds: [],
        playCount: Math.floor(Math.random() * 5000) + 100,
        likeCount: Math.floor(Math.random() * 500) + 10,
        commentCount: 0,
        isPublic: true,
      },
    });

    singles.push(created);
  }

  console.log(`Da tao ${singles.length} bai hat single.`);

  const playlists = [] as Awaited<ReturnType<typeof prisma.music.create>>[];

  for (let i = 0; i < PLAYLIST_SEED.length; i += 1) {
    const item = PLAYLIST_SEED[i];
    const shuffled = [...singles].sort(() => 0.5 - Math.random());
    const selectedTracks = shuffled.slice(0, item.size);
    const trackIds = selectedTracks.map((track) => track.id);

    const created = await prisma.music.create({
      data: {
        title: item.title,
        slug: getUniqueSlug(item.title, usedSlugs),
        artist: item.artist,
        description: item.description,
        tags: item.tags,
        thumbnailUrl: `https://picsum.photos/seed/music_playlist_${i}/600/600`,
        audioUrl: selectedTracks[0]?.audioUrl || '',
        audioDuration: selectedTracks.reduce((sum, track) => sum + (track.audioDuration || 0), 0),
        contentType: MusicContentType.playlist,
        playlistTrackIds: trackIds,
        playCount: Math.floor(Math.random() * 10000) + 500,
        likeCount: Math.floor(Math.random() * 1000) + 50,
        commentCount: 0,
        isPublic: true,
      },
    });

    playlists.push(created);
  }

  console.log(`Da tao ${playlists.length} playlist he thong.`);

  for (const track of singles) {
    for (const user of users) {
      if (Math.random() > 0.5) {
        await prisma.musicLike.create({
          data: {
            userId: user.id,
            musicId: track.id,
          },
        });

        await prisma.music.update({
          where: { id: track.id },
          data: { likeCount: { increment: 1 } },
        });
      }

      if (Math.random() > 0.3) {
        await prisma.musicHistory.create({
          data: {
            userId: user.id,
            musicId: track.id,
            listenedAt: new Date(Date.now() - Math.floor(Math.random() * 10000000)),
            progressSeconds: Math.random() > 0.4
              ? Math.floor(Math.random() * (track.audioDuration || 180) * 0.9)
              : undefined,
          },
        });
      }
    }
  }

  const userPlaylist = await prisma.musicPlaylist.create({
    data: {
      userId: mainUser.id,
      title: 'Nhac Yeu Thich Cua Toi',
      isPublic: false,
      coverImage: 'https://picsum.photos/seed/user_personal_playlist/500/500',
    },
  });

  await prisma.musicPlaylist.create({
    data: {
      userId: mainUser.id,
      title: 'Danh sach phat tiep theo',
      isPublic: false,
    },
  });

  const favoriteTrackIds = singles.slice(0, 3).map((track) => track.id);
  for (let i = 0; i < favoriteTrackIds.length; i += 1) {
    await prisma.musicPlaylistTrack.create({
      data: {
        playlistId: userPlaylist.id,
        musicId: favoriteTrackIds[i],
        orderIndex: i,
      },
    });
  }

  console.log('Seed music thanh cong.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
