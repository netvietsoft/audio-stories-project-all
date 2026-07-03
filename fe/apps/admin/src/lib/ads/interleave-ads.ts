export type InlineFeedRow<Item, Ad> =
  | {
      type: "item";
      item: Item;
    }
  | {
      type: "ad";
      id: string;
      ad: Ad;
    };

export const interleaveAds = <Item, Ad>(
  items: Item[],
  ads: Ad[],
  options?: {
    every?: number;
    getAdId?: (ad: Ad, item: Item, index: number) => string;
  },
): InlineFeedRow<Item, Ad>[] => {
  const every = options?.every && options.every > 0 ? options.every : 6;

  if (!items.length) return [];
  if (!ads.length) {
    return items.map((item) => ({
      type: "item",
      item,
    }));
  }

  const rows: InlineFeedRow<Item, Ad>[] = [];

  items.forEach((item, index) => {
    rows.push({
      type: "item",
      item,
    });

    if ((index + 1) % every !== 0) return;

    const ad = ads[Math.floor(index / every) % ads.length];
    if (!ad) return;

    rows.push({
      type: "ad",
      id: options?.getAdId ? options.getAdId(ad, item, index) : `ad-${index}`,
      ad,
    });
  });

  return rows;
};
