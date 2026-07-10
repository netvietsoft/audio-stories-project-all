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
}

export const RANKING_METRICS: RankingMetric[] = [
  { key: 'reads', label: 'Đọc nhiều', storyMetric: 'reads', geoKind: 'view' },
  { key: 'rating', label: 'Đánh giá', storyMetric: 'rating', geoKind: 'rating' },
  { key: 'comments', label: 'Bình luận', storyMetric: 'comments', geoKind: 'comment' },
  { key: 'favorites', label: 'Yêu thích', storyMetric: 'favorites', geoKind: 'favorite' },
  { key: 'gifts', label: 'Tặng quà', storyMetric: 'gifts', geoKind: 'gift' },
  { key: 'trending', label: 'Xu hướng', storyMetric: 'trending', geoKind: 'trending' },
  { key: 'search', label: 'Tìm kiếm', storyMetric: 'search', geoKind: 'search' },
  { key: 'revenue', label: 'Doanh thu', storyMetric: 'revenue', geoKind: 'revenue' },
  { key: 'audio', label: 'Nghe audio', storyMetric: 'audio', geoKind: 'listen' },
];

export function getMetric(key: RankingMetricKey): RankingMetric {
  return RANKING_METRICS.find((m) => m.key === key) ?? RANKING_METRICS[0];
}

export function formatMetricValue(metric: RankingMetric, value: number, isGeo = false): string {
  const v = value ?? 0;
  if (metric.key === 'trending') return Math.round(v).toLocaleString('vi-VN'); // điểm decay -> làm tròn (cả global & geo)
  if (metric.key === 'rating' && !isGeo) return v.toFixed(2);                  // rating global = trung bình Bayesian (số thực)
  return v.toLocaleString('vi-VN');                                            // đếm nguyên (gồm rating theo quốc gia)
}
