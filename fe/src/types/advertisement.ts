export type AdvertisementItem = {
  id: string;
  partnerName: string;
  title: string;
  contentType?: "image" | "iframe";
  imageUrl?: string | null;
  targetUrl?: string | null;
  iframeCode?: string | null;
  isActive: boolean;
  // Optional fields used by admin / unlock flow
  isGlobal?: boolean;
  language?: string | null;
  languageId?: number | null;
  // 1 = inline, 2 = unlock
  routeType?: number;
  clickCount?: number;
};
