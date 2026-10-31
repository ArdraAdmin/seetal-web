import { NextResponse } from "next/server";
import { customAccessForToken, CustomUserError } from "@/lib/server/custom-users";
import { isDatabaseNotConfigured } from "@/lib/server/mongo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("authorization") || req.headers.get("Authorization");
    const access = await customAccessForToken(token);
    return NextResponse.json({ access });
  } catch (error) {
    if (error instanceof CustomUserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isDatabaseNotConfigured(error)) {
      return NextResponse.json({ access: null });
    }
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
