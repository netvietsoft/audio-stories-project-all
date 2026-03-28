import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const query = request.nextUrl.searchParams.toString();
  const endpoint = query
    ? `${API_BASE_URL}/stories/${slug}?${query}`
    : `${API_BASE_URL}/stories/${slug}`;

  try {
    const upstream = await fetch(endpoint, {
      cache: "no-store",
    });

    const body = await upstream.json();

    return NextResponse.json(body, {
      status: upstream.status,
    });
  } catch {
    return NextResponse.json(
      { message: "Failed to fetch story details" },
      { status: 502 },
    );
  }
}
