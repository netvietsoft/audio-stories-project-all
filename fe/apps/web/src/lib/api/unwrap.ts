/**
 * Helpers chống lỗi ".map/.slice is not a function" do BE bọc response không nhất quán.
 *
 * BE bọc response qua global interceptor thành { data: ... }. Một số endpoint (vd
 * /stories/explore) service đã trả { data, pagination } nên bị bọc 2 lớp:
 * { data: { data: [...], pagination } }. Axios còn thêm 1 lớp res.data nữa.
 *
 * Dùng các helper này để LẤY DỮ LIỆU AN TOÀN bất kể bọc 0/1/2 lớp.
 */

/** Lấy MẢNG từ response bất kể bọc bao nhiêu lớp: [], {data:[]}, {data:{data:[]}}. */
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
