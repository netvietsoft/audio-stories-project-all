export interface Story {
    id: string;
    title?: string;
    titleVi?: string;
    titleEn?: string;
    slug?: string;
    thumbnailUrl?: string;
}

export interface Category {
    id: number;
    name: string;
    nameVi?: string;
    nameEn?: string;
    language?: string;
}

export interface Author {
    id: string;
    name: string;
}

export interface Variant {
    id: string;
    title: string;
    description?: string;
    content?: string;
    audioUrl?: string;
    r2AudioUrl?: string;
    audioDuration?: number;
    unlockPrice: number;
    orderIndex: number;
    nextChapterId?: string | null;
    nextVariantId?: string | null;
    isDefault?: boolean;
}

export interface Chapter {
    id: string;
    chapterNumber: number;
    title: string;
    titleVi?: string;
    titleEn?: string;
    description?: string | null;
    content?: string | null;
    r2AudioUrl?: string | null;
    thumbnailUrl?: string | null;
    youtubeVideoId?: string | null;
    audioDuration?: number | null;
    accessType?: 'free' | 'timed' | 'vip' | 'ads';
    unlockPrice?: number;
    discountPercent?: number;
    unlocksAt?: string | null;
    unlockAdId?: string | null;
    language?: string | null;
    createdAt: string;
    storyId?: string | null;
    story?: Story;
    variants?: Variant[];
    _count?: {
        variants: number;
    };
}

export type StorySubmitPayload = {
    title: string;
    slug: string;
    language?: string;
    description?: string;
    thumbnailUrl?: string;
    authorId: string;
    status: 'ongoing' | 'completed';
    categoryIds: number[];
    audioUrl?: string;
    isRecommended?: boolean;
    isInteractive?: boolean;
    unlockPrice?: number;
    discountPercent?: number;
    chapterIds?: string[];
};
