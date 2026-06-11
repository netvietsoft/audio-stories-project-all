export type AdvertisementItem = {
  id: string;
  partnerName: string;
  title: string;
  contentType?: "image" | "iframe" | "youtube";
  imageUrl?: string | null;
  targetUrl?: string | null;
  iframeCode?: string | null;
  youtubeId?: string | null;
  youtubePlayTime?: number | null;
  countdownSeconds?: number | null;
  isForcedRedirect?: boolean;
  isActive: boolean;
  // Optional fields used by admin / unlock flow
  isGlobal?: boolean;
  language?: string | null;
  languageId?: number | null;
  // 1 = inline, 2 = unlock
  routeType?: number;
  clickCount?: number;
};
