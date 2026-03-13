"use server";

import { revalidateTag } from "next/cache";

export async function revalidateStoriesCache() {
  revalidateTag("stories-explore", "max");
}
