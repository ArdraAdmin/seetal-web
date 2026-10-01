import { ObjectId } from "mongodb";
import { getMongoClient, isDatabaseNotConfigured } from "./mongo";
import { userIdFromAuthHeader } from "./password";

type UserDoc = {
  _id: ObjectId;
  role?: string;
};

const REMOTE_API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

function asObjectId(id: unknown): ObjectId {
  const value = String(id ?? "").trim();
  if (!ObjectId.isValid(value)) throw new Error("user does not exist");
  return new ObjectId(value);
}

export async function deleteSalesOrWarehouseProfile(input: {
  token: string | null;
  userId: unknown;
}): Promise<void> {
  const adminId = userIdFromAuthHeader(input.token);
  const client = await getMongoClient();
  const db = client.db();
  const users = db.collection<UserDoc>("users");

  const admin = await users.findOne({ _id: new ObjectId(adminId) });
  if (!admin || admin.role !== "Admin") {
    throw new Error("Not allowed");
  }

  const id = asObjectId(input.userId);
  const user = await users.findOne({ _id: id });
  if (!user) throw new Error("user does not exist");
  if (user.role === "Admin") {
    throw new Error("Admin profiles cannot be deleted");
  }
  if (user.role !== "Sales" && user.role !== "Warehouse") {
    throw new Error("Only sales and warehouse profiles can be deleted");
  }

  await db.collection("stores").updateMany(
    { salesPerson: id },
    { $unset: { salesPerson: "" } },
  );
  await db.collection("tempstores").updateMany(
    { salesPerson: id },
    { $unset: { salesPerson: "" } },
  );
  await users.deleteOne({ _id: id });
}

export async function proxyDeleteUser(
  req: Request,
  userId: string,
): Promise<Response> {
  const headers = new Headers();
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);

  const res = await fetch(
    `${REMOTE_API}/admin/edit/deleteUser/${encodeURIComponent(userId)}`,
    { method: "DELETE", headers },
  );
  const text = await res.text();
  return new Response(text, { status: res.status });
}

export { isDatabaseNotConfigured };
