import {
  changeOwnPassword,
  isDatabaseNotConfigured,
  proxyChangePassword,
} from "@/lib/server/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");

  try {
    await changeOwnPassword({
      token,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
    });
    return new Response("Password updated", { status: 200 });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return proxyChangePassword(req, body);
    }
    const message =
      error instanceof Error ? error.message : "Unable to update password";
    const status = message === "Not signed in" ? 401 : 400;
    return new Response(message, { status });
  }
}
