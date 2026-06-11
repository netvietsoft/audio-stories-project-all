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

  return (await response.json()) as T;
}
