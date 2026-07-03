// Định dạng số nguyên có dấu phân tách nghìn kiểu vi-VN (1.000.000).
export const formatThousand = (n?: number | null): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("vi-VN").format(n);
};
// Lấy số nguyên từ chuỗi người dùng gõ (bỏ mọi ký tự không phải chữ số).
export const parseThousand = (s: string): number => {
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};
