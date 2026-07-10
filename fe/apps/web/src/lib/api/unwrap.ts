/**
 * Helpers chống lỗi ".map/.slice is not a function" do BE bọc response không nhất quán.
 * (Bản sao cho app web — giống fe/apps/admin/src/lib/api/unwrap.ts.)
 *
 * apiClient web KHÔNG unwrap (interceptor pass-through) -> response.data = body BE
 * = { data: ... , meta }. List endpoint bọc 2 lớp { data: { data: [...], meta } };
 * object đơn bọc 1 lớp { data: {...} }. Dùng helper để lấy dữ liệu an toàn mọi độ bọc.
 */

/** Lấy MẢNG từ response bất kể bọc 0/1/2 lớp: [], {data:[]}, {data:{data:[]}}. */
export function unwrapList<T = any>(input: any): T[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.data?.data)) return input.data.data;
  return [];
}

/** Lấy OBJECT payload (không phải mảng) từ envelope: x, {data:x}, {data:{data:x}}. */
export function unwrapData<T = any>(input: any): T | null {
  if (input === null || input === undefined) return null;
  if (Array.isArray(input)) return input as unknown as T;
  const d1 = input?.data;
  if (d1 === undefined) return input as T;
  if (d1 !== null && typeof d1 === 'object' && !Array.isArray(d1) && d1.data !== undefined) {
    return d1.data as T;
  }
  return d1 as T;
}
