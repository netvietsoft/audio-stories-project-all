export type RankingMetricKey =
  | 'reads' | 'rating' | 'comments' | 'favorites' | 'gifts'
  | 'trending' | 'search' | 'revenue' | 'audio';

export interface RankingMetric {
  key: RankingMetricKey;
  label: string;
  /** tham số cho /stats/top-stories?metric= */
  storyMetric: string;
  /** kind cho 3 endpoint geo (top-countries / top-stories-by-country / story-top-countries) */
  geoKind: string;
  /** value là số thực (rating/trending) -> format khác số đếm */
  isDecimal?: boolean;
}

export const RANKING_METRICS: RankingMetric[] = [
  { key: 'reads', label: 'Đọc nhiều', storyMetric: 'reads', geoKind: 'view' },
  { key: 'rating', label: 'Đánh giá', storyMetric: 'rating', geoKind: 'rating', isDecimal: true },
  { key: 'comments', label: 'Bình luận', storyMetric: 'comments', geoKind: 'comment' },
  { key: 'favorites', label: 'Yêu thích', storyMetric: 'favorites', geoKind: 'favorite' },
  { key: 'gifts', label: 'Tặng quà', storyMetric: 'gifts', geoKind: 'gift' },
  { key: 'trending', label: 'Xu hướng', storyMetric: 'trending', geoKind: 'trending', isDecimal: true },
  { key: 'search', label: 'Tìm kiếm', storyMetric: 'search', geoKind: 'search' },
  { key: 'revenue', label: 'Doanh thu', storyMetric: 'revenue', geoKind: 'revenue' },
  { key: 'audio', label: 'Nghe audio', storyMetric: 'audio', geoKind: 'listen' },
];

export function getMetric(key: RankingMetricKey): RankingMetric {
  return RANKING_METRICS.find((m) => m.key === key) ?? RANKING_METRICS[0];
}

export function formatMetricValue(metric: RankingMetric, value: number): string {
  const v = value ?? 0;
  if (metric.key === 'rating') return v.toFixed(2);
  if (metric.key === 'trending') return Math.round(v).toLocaleString('vi-VN');
  return v.toLocaleString('vi-VN');
}
