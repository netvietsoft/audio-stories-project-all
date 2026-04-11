import { PrismaClient, MusicContentType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu seed dữ liệu test cho phần Music...');

  const users = await prisma.user.findMany({ take: 5 });
  if (users.length === 0) {
    console.warn('Không tìm thấy user nào, vui lòng chạy seed chính trước (yarn seed) hoặc tạo user!');
    return;
  }
  const mainUser = users[0];

  // --- TẠO CÁC BÀI NHẠC LẺ (TRACKS) ---
  const singlesData = [
    { title: 'Chill Vibes Lofi', artist: 'Lofi Girl', description: 'Nhạc lofi thư giãn học tập', duration: 180, tags: ['lofi', 'chill', 'study'] },
    { title: 'Rainy Night Piano', artist: 'John Doe', description: 'Tiếng đàn piano trong đêm mưa', duration: 250, tags: ['piano', 'instrumental'] },
    { title: 'Cyberpunk City', artist: 'Synthwave Boy', description: 'Nhạc điện tử sôi động', duration: 210, tags: ['synthwave', 'electronic'] },
    { title: 'Morning Coffee', artist: 'Acoustic Band', description: 'Nhạc acoustic buổi sáng sớm', duration: 195, tags: ['acoustic', 'morning'] },
    { title: 'Epic Mountain', artist: 'Orchestra Pro', description: 'Nhạc thính phòng hùng tráng', duration: 320, tags: ['epic', 'orchestra'] },
    { title: 'Sunset Drive', artist: 'Retro Master', description: 'Nhạc lofi cực chill lúc hoàng hôn', duration: 240, tags: ['lofi', 'retro'] },
    { title: 'Deep Sleep', artist: 'Ambient Sounds', description: 'Nhạc ambient dễ ngủ định tâm', duration: 300, tags: ['ambient', 'sleep'] },
    { title: 'Workout Beats', artist: 'DJ Gym', description: 'Nhạc tập gym cực kỳ sung mãn', duration: 215, tags: ['gym', 'beat'] },
    { title: 'Focus Energy', artist: 'Dr. Focus', description: 'Âm thanh sóng não tập trung', duration: 400, tags: ['focus', 'binaural'] },
    { title: 'Summer Pop', artist: 'Idol Pop', description: 'Bài hát pop cực kỳ sôi động cho mùa hè', duration: 185, tags: ['pop', 'summer'] },
    { title: 'Sad Song', artist: 'Broken Lips', description: 'Một bài nhạc buồn cho ngày mưa', duration: 220, tags: ['sad', 'pop', 'vocal'] },
    { title: 'Healing Water', artist: 'Nature Spirit', description: 'Tiếng suối róc rách chữa lành', duration: 280, tags: ['nature', 'healing'] },
    { title: 'Rock The Stage', artist: 'Metal Head', description: 'Rock cháy máy cùng ban nhạc metal', duration: 210, tags: ['rock', 'metal'] },
    { title: 'Jazz Club', artist: 'Saxophone Man', description: 'Đêm nhạc acoustic tại quán jazz nhỏ', duration: 260, tags: ['jazz', 'saxophone'] },
    { title: 'K-pop Dance', artist: 'K-Stars', description: 'Nhịp điệu dồn dập khiến bạn muốn nhảy múa', duration: 190, tags: ['kpop', 'dance'] }
  ];

  const createdSingles: any[] = [];
  for (let i = 0; i < singlesData.length; i++) {
    const data = singlesData[i];
    const track = await prisma.music.create({
      data: {
        title: data.title,
        artist: data.artist,
        description: data.description,
        tags: data.tags,
        // Dùng ảnh ngẫu nhiên nhưng cố định kích thước
        thumbnailUrl: `https://picsum.photos/seed/music_single_${i}/600/600`, 
        // 5 bài âm thanh public sample để test (lặp lại file)
        audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 5) + 1}.mp3`,
        audioDuration: data.duration,
        contentType: MusicContentType.single,
        playCount: Math.floor(Math.random() * 5000) + 100,
        likeCount: Math.floor(Math.random() * 500) + 10,
        commentCount: 0,
        isPublic: true,
      }
    });
    createdSingles.push(track);
  }
  console.log(`Đã tạo ${createdSingles.length} bài hát lẻ (single).`);

  // --- TẠO CÁC SYSTEM PLAYLISTS ---
  // (Đúng như mô tả: playlist hệ thống sẽ là Music track nhưng có contentType='playlist' và mảng playlistTrackIds)
  const systemPlaylistsData = [
    { title: 'Top Lofi Để Học Tập', artist: 'Hệ Thống', description: 'Playlist lofi cực chill giúp tập trung tối đa', tags: ['lofi', 'study', 'playlist'] },
    { title: 'Nhạc Acoustic Nhẹ Nhàng', artist: 'Hệ Thống', description: 'Những bài hát mộc mạc thư giãn cuối tuần', tags: ['acoustic', 'guitar', 'playlist'] },
    { title: 'Top Hits Tuần Này', artist: 'Hệ Thống', description: 'Các bài hát có lượt nghe cao nhất', tags: ['top', 'hits', 'pop'] },
  ];

  const createdSysPlaylists: any[] = [];
  for (let i = 0; i < systemPlaylistsData.length; i++) {
    // Chọn random 4-6 bài từ singles
    const shuffled = [...createdSingles].sort(() => 0.5 - Math.random());
    const selectedTracks = shuffled.slice(0, Math.floor(Math.random() * 3) + 4);
    const trackIds = selectedTracks.map(t => t.id);

    const playlist = await prisma.music.create({
      data: {
        title: systemPlaylistsData[i].title,
        artist: systemPlaylistsData[i].artist,
        description: systemPlaylistsData[i].description,
        tags: systemPlaylistsData[i].tags,
        // Ảnh vuông của playlist hệ thống
        thumbnailUrl: `https://picsum.photos/seed/music_sys_playlist_${i}/600/600`,
        // AudioUrl (có thể lấy audio của bài đầu tiên cho việc play thử hoặc rỗng tùy theo logic, ở đây cứ gắn bài 1)
        audioUrl: selectedTracks[0].audioUrl,
        audioDuration: selectedTracks.reduce((sum, current) => sum + (current.audioDuration || 0), 0),
        contentType: MusicContentType.playlist,
        playlistTrackIds: trackIds, // Lưu ds các track id thuộc playlist này
        playCount: Math.floor(Math.random() * 10000) + 500,
        likeCount: Math.floor(Math.random() * 1000) + 50,
        commentCount: 0,
        isPublic: true,
      }
    });
    createdSysPlaylists.push(playlist);
  }
  console.log(`Đã tạo ${createdSysPlaylists.length} playlist trên hệ thống.`);

  // --- TẠO CÁC TEST DATA TƯƠNG TÁC (COMMENTS, LIKES, HISTORY) ---
  for (const track of createdSingles) {
    // Random likes from users
    for (const u of users) {
      if (Math.random() > 0.5) {
        await prisma.musicLike.create({
          data: {
            userId: u.id,
            musicId: track.id,
          }
        });
        
        // Cập nhật like count (để khớp)
        await prisma.music.update({
          where: { id: track.id },
          data: { likeCount: { increment: 1 } }
        });
      }

      // Random history
      if (Math.random() > 0.3) {
        await prisma.musicHistory.create({
          data: {
            userId: u.id,
            musicId: track.id,
            listenedAt: new Date(Date.now() - Math.floor(Math.random() * 10000000)),
          }
        });
      }
    }

    // Tự động seed một số comments cho vài bài hát nổi bật hơn
    if (Math.random() > 0.6) {
      const commentCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < commentCount; j++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        await prisma.musicComment.create({
          data: {
            userId: randomUser.id,
            musicId: track.id,
            content: `Bài này hay quá, thật tuyệt vời! Lần duyệt thứ ${j + 1}`
          }
        });
        await prisma.music.update({
          where: { id: track.id },
          data: { commentCount: { increment: 1 } }
        });
      }
    }
  }
  console.log('Đã tạo tương tác (Likes, History, Comments).');

  // --- TẠO PLAYLIST CÁ NHÂN CỦA USER ---
  // Để user test chức năng "thêm vào playlist cá nhân lưu trữ" (như mô tả pop-up tạo/chọn của người dùng)
  
  const userPlaylist = await prisma.musicPlaylist.create({
    data: {
      userId: mainUser.id,
      title: 'Nhạc Yêu Thích Của Tôi',
      isPublic: false,
      coverImage: 'https://picsum.photos/seed/user_personal_playlist/500/500',
    }
  });

  const nextUpPlaylist = await prisma.musicPlaylist.create({
    data: {
      userId: mainUser.id,
      title: 'Danh sách phát tiếp theo',
      isPublic: false,
    }
  });

  // Gắn vài bài ngẫu nhiên vào playlist cá nhân này
  const favTrackIds = createdSingles.slice(0, 3).map(t => t.id);
  for (let i = 0; i < favTrackIds.length; i++) {
    await prisma.musicPlaylistTrack.create({
      data: {
        playlistId: userPlaylist.id,
        musicId: favTrackIds[i],
        orderIndex: i
      }
    });
  }
  
  console.log(`Đã tạo các playlist cá nhân cho user [${mainUser.displayName} / ${mainUser.email}]`);
  
  console.log('✅ SEED MUSIC THÀNH CÔNG!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
