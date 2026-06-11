import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const endpoint = query
    ? `${API_BASE_URL}/stories/explore?${query}`
    : `${API_BASE_URL}/stories/explore`;

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
      { message: "Failed to fetch explore stories" },
      { status: 502 },
    );
  }
}
