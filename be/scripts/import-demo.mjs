// One-off importer for the demo content (Che Linh album + Tran Dang Khoa works).
// Run from be/:  node scripts/import-demo.mjs   (DATABASE_URL must be set)
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();
const VI = 1; // languages.id for 'vi'

const SCRATCH = 'C:\\Users\\PCF2AA~1.DES\\AppData\\Local\\Temp\\claude\\D--SetupC-Projects-GPSPhoto\\1abb3bda-7ac0-4aef-95d1-38cac7299ac1\\scratchpad';
const DOC_TXT = SCRATCH + '\\doc_txt';
const MUSIC_MANIFEST = SCRATCH + '\\music_manifest.json';

// Strip combining diacritics (U+0300..U+036F) via code points — no regex literal needed.
function stripDiacritics(nfd) {
  let out = '';
  for (let i = 0; i < nfd.length; i++) {
    const c = nfd.charCodeAt(i);
    if (c >= 0x300 && c <= 0x36f) continue;
    out += nfd[i];
  }
  return out;
}

function slugify(text) {
  return stripDiacritics((text || '').toString().normalize('NFD'))
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Remove control chars (keep \n=10, \t=9) via code points — no control-char regex literal.
function cleanText(t) {
  const s = (t || '').replace(/\r\n?/g, '\n');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || c >= 32) out += s[i];
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitChapters(text, maxLen = 6000) {
  const clean = cleanText(text);
  const paras = clean.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chapters = [];
  let buf = '';
  for (const p of paras) {
    if (buf.length + p.length > maxLen && buf) {
      chapters.push(buf.trim());
      buf = '';
    }
    buf += p + '\n\n';
  }
  if (buf.trim()) chapters.push(buf.trim());
  return chapters.length ? chapters : [clean];
}

const STORY_FILES = [
  { file: 'ĐẢO CHÌM.txt', title: 'Đảo Chìm' },
  { file: 'CHÂN DUNG VÀ  ĐỐI THOẠI.txt', title: 'Chân Dung Và Đối Thoại' },
  { file: 'NGƯỜI THƯỜNG GẶP.txt', title: 'Người Thường Gặp' },
  { file: '+Trần Đăng Khoa.txt', title: 'Tuyển Tập Trần Đăng Khoa' },
];

async function importAuthor() {
  const slug = 'tran-dang-khoa';
  const author = await prisma.author.upsert({
    where: { slug },
    update: {},
    create: {
      name: 'Trần Đăng Khoa',
      slug,
      languageId: VI,
      bio: 'Nhà thơ, nhà văn Việt Nam nổi tiếng.',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Tran%20Dang%20Khoa',
    },
  });
  console.log('Author:', author.name, author.id);
  return author;
}

async function importStories(author) {
  for (const s of STORY_FILES) {
    const slug = slugify(s.title);
    const existing = await prisma.story.findFirst({ where: { slug, languageId: VI } });
    if (existing) {
      console.log('Story exists, skip:', s.title);
      continue;
    }
    let raw = '';
    try {
      raw = readFileSync(`${DOC_TXT}\\${s.file}`, 'utf8');
    } catch (e) {
      console.log('Missing txt, skip:', s.file);
      continue;
    }
    const chapters = splitChapters(raw);
    const description = cleanText(raw).replace(/\n+/g, ' ').slice(0, 280);

    const story = await prisma.story.create({
      data: {
        title: s.title,
        slug,
        languageId: VI,
        authorId: author.id,
        description,
        status: 'completed',
        thumbnailUrl: `https://picsum.photos/seed/${slug}/600/900`,
        isRecommended: true,
        publishedAt: new Date(),
        totalChapters: chapters.length,
      },
    });

    let n = 1;
    for (const content of chapters) {
      await prisma.chapter.create({
        data: {
          storyId: story.id,
          chapterNumber: n,
          title: `Chương ${n}`,
          languageId: VI,
          content,
          accessType: 'free',
        },
      });
      n++;
    }
    console.log(`Story: ${s.title} -> ${chapters.length} chapters`);
  }
}

async function importMusic() {
  const tracks = JSON.parse(readFileSync(MUSIC_MANIFEST, 'utf8').replace(/^﻿/, ''));
  const arr = Array.isArray(tracks) ? tracks : [tracks];
  const ids = [];
  for (const t of arr) {
    const m = await prisma.music.upsert({
      where: { slug: t.slug },
      update: { audioUrl: t.audioUrl },
      create: {
        title: t.title,
        slug: t.slug,
        artist: 'Chế Linh',
        description: 'Album "Hát Cho Người Tình Phụ" - Chế Linh.',
        thumbnailUrl: `https://picsum.photos/seed/${t.slug}/600/600`,
        audioUrl: t.audioUrl,
        contentType: 'single',
        accessType: 'free',
        tags: ['Bolero', 'Trữ tình', 'Chế Linh'],
        isPublic: true,
      },
    });
    ids.push(m.id);
  }
  console.log(`Music tracks: ${ids.length}`);

  const albumSlug = 'che-linh-hat-cho-nguoi-tinh-phu';
  await prisma.music.upsert({
    where: { slug: albumSlug },
    update: { playlistTrackIds: ids },
    create: {
      title: 'Hát Cho Người Tình Phụ',
      slug: albumSlug,
      artist: 'Chế Linh',
      description: 'Tuyển tập Bolero trữ tình của Chế Linh.',
      thumbnailUrl: `https://picsum.photos/seed/${albumSlug}/600/600`,
      audioUrl: arr[0]?.audioUrl || '',
      contentType: 'playlist',
      accessType: 'free',
      tags: ['Bolero', 'Trữ tình', 'Chế Linh'],
      playlistTrackIds: ids,
      isPublic: true,
    },
  });
  console.log('Album playlist created.');
}

async function main() {
  const author = await importAuthor();
  await importStories(author);
  await importMusic();
}

main()
  .then(() => console.log('DONE'))
  .catch((e) => {
    console.error('IMPORT FAILED:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
