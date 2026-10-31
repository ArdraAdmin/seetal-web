import { NextResponse } from "next/server";
import {
  createCustomUser,
  CustomUserError,
  listCustomUsers,
} from "@/lib/server/custom-users";
import { isDatabaseNotConfigured } from "@/lib/server/mongo";

export const runtime = "nodejs";

function tokenFrom(req: Request) {
  return req.headers.get("authorization") || req.headers.get("Authorization");
}

function fail(error: unknown) {
  if (error instanceof CustomUserError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (isDatabaseNotConfigured(error)) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : "Request failed";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: Request) {
  try {
    const users = await listCustomUsers(tokenFrom(req));
    return NextResponse.json({ users });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await createCustomUser(tokenFrom(req), body);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
