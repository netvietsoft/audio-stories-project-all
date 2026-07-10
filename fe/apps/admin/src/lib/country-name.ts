// Đổi mã ISO 2 ký tự (VN, US) sang tên quốc gia tiếng Việt; fallback về mã in hoa.
const displayNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['vi'], { type: 'region' })
    : null;

export function countryName(code: string): string {
  if (!code) return '';
  const upper = code.toUpperCase();
  try {
    return displayNames?.of(upper) ?? upper;
  } catch {
    return upper;
  }
}
