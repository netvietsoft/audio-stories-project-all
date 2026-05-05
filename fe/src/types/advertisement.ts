export type AdvertisementItem = {
  id: string;
  partnerName: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  isActive: boolean;
  // Optional fields used by admin / unlock flow
  isGlobal?: boolean;
  language?: string | null;
  languageId?: number | null;
  // 1 = inline, 2 = unlock
  routeType?: number;
};
