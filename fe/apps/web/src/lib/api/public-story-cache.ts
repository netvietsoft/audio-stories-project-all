type ExploreParamsValue = string | number | null | undefined;

const buildQuery = (params: Record<string, ExploreParamsValue>) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });

  return search.toString();
};

export async function fetchExploreCached<T>(
  params: Record<string, ExploreParamsValue>,
): Promise<T> {
  const query = buildQuery(params);
  const url = query
    ? `/api/public/stories/explore?${query}`
    : "/api/public/stories/explore";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Explore API failed with status ${response.status}`);
  }

  const json: any = await response.json();
  // Shape from BE: { data: { data: [...], meta: { total, page, lastPage } }, meta: { requestId } }
  // (service wraps { data, meta } and the global interceptor wraps again). May also be
  // single-wrapped { data: [...], meta } or a bare array. Normalize so callers can rely on
  // `.data` = array AND `.meta` = pagination ({ total, page, lastPage }).
  const list = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.data?.data)
        ? json.data.data
        : [];
  // Pagination meta lives at data.meta (double-wrapped) or meta/pagination (single-wrapped).
  const meta = json?.data?.meta ?? json?.pagination ?? json?.data?.pagination ?? json?.meta ?? {};
  return { data: list, meta, pagination: meta } as T;
}
