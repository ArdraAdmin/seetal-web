import { createHmac, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getMongoClient, isDatabaseNotConfigured } from "./mongo";

const JWT_SECRET = "mySecret";
const REMOTE_API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

type UserDoc = {
  _id: ObjectId;
  role?: string;
  password?: string;
};

function toBase64Url(value: Buffer | string): string {
  const buf = typeof value === "string" ? Buffer.from(value) : value;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function userIdFromAuthHeader(header: string | null): string {
  const token = String(header ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Not signed in");
  const [headerPart, payloadPart, signaturePart] = parts;
  const expected = toBase64Url(
    createHmac("sha256", JWT_SECRET).update(`${headerPart}.${payloadPart}`).digest(),
  );
  const actual = Buffer.from(signaturePart);
  const expectedBuf = Buffer.from(expected);
  if (
    actual.length !== expectedBuf.length ||
    !timingSafeEqual(actual, expectedBuf)
  ) {
    throw new Error("Not signed in");
  }
  const payload = JSON.parse(
    Buffer.from(payloadPart, "base64url").toString("utf8"),
  ) as { _id?: string };
  const id = String(payload._id ?? "").trim();
  if (!id || !ObjectId.isValid(id)) throw new Error("Not signed in");
  return id;
}

function validateNewPassword(newPassword: string, confirmPassword: string) {
  if (newPassword.length < 4 || confirmPassword.length < 4) {
    throw new Error("Password should be greater than 4 characters");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("Passwords do not match");
  }
  if (/\s/.test(newPassword) || /\s/.test(confirmPassword)) {
    throw new Error("Password should not contain whitespaces");
  }
}

export async function changeOwnPassword(input: {
  token: string | null;
  currentPassword: unknown;
  newPassword: unknown;
  confirmPassword: unknown;
}): Promise<void> {
  const currentPassword = String(input.currentPassword ?? "");
  const newPassword = String(input.newPassword ?? "");
  const confirmPassword = String(input.confirmPassword ?? "");
  if (!currentPassword) throw new Error("Enter your current password");
  validateNewPassword(newPassword, confirmPassword);

  const userId = userIdFromAuthHeader(input.token);
  const client = await getMongoClient();
  const users = client.db().collection<UserDoc>("users");
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error("No User found");
  if (user.role !== "Admin" && user.role !== "Sales") {
    throw new Error("Not allowed to change Password");
  }
  if (!user.password) throw new Error("Current password is incorrect");
  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) throw new Error("Current password is incorrect");
  if (currentPassword === newPassword) {
    throw new Error("New password must be different from the current password");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await users.updateOne(
    { _id: user._id },
    {
      $set: { password: hashed },
      $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
    },
  );
}

export async function proxyChangePassword(
  req: Request,
  payload: unknown,
): Promise<Response> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);

  const res = await fetch(`${REMOTE_API}/user/changePassword`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "text/plain",
    },
  });
}

export { isDatabaseNotConfigured };
