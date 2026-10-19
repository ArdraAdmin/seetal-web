import { isDatabaseNotConfigured } from "@/lib/server/mongo";
import {
  readSundayDeliveryForUser,
  writeSundayDelivery,
} from "@/lib/server/sunday-delivery";

export const runtime = "nodejs";

function tokenFrom(req: Request) {
  return req.headers.get("authorization") || req.headers.get("Authorization");
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not update setting";
  if (isDatabaseNotConfigured(error)) return { message, status: 503 };
  if (message === "Not signed in" || message === "Not allowed") {
    return { message, status: message === "Not allowed" ? 403 : 401 };
  }
  return { message, status: 400 };
}

export async function GET(req: Request) {
  try {
    const result = await readSundayDeliveryForUser(tokenFrom(req));
    return Response.json(result);
  } catch (error) {
    const { message, status } = errorStatus(error);
    return Response.json({ error: message }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { sundayDelivery?: unknown };
    const sundayDelivery = await writeSundayDelivery(
      tokenFrom(req),
      body.sundayDelivery === true,
    );
    return Response.json({ sundayDelivery });
  } catch (error) {
    const { message, status } = errorStatus(error);
    return Response.json({ error: message }, { status });
  }
}
