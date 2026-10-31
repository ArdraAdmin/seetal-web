import { NextResponse } from "next/server";
import {
  CustomUserError,
  deleteCustomUser,
  getCustomUser,
  updateCustomUser,
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

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const user = await getCustomUser(tokenFrom(req), id);
    return NextResponse.json({ user });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const user = await updateCustomUser(tokenFrom(req), id, await req.json());
    return NextResponse.json({ user });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteCustomUser(tokenFrom(req), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
