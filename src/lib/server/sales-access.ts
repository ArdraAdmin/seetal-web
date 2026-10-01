import { ObjectId } from "mongodb";
import { companyIds } from "@/lib/profiles";
import { resolveCatalogAccess } from "@/lib/sales-company";
import { getMongoClient } from "@/lib/server/mongo";
import { userIdFromAuthHeader } from "@/lib/server/password";

const REMOTE_API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

type UserDoc = {
  _id: ObjectId;
  role?: string;
  field?: { sales?: { company?: unknown } };
};

type CompanyDoc = {
  _id: ObjectId;
  name?: string;
};

async function accessFromRemote(token: string | null, userId: string) {
  const headers = new Headers();
  if (token) headers.set("Authorization", token);
  const res = await fetch(
    `${REMOTE_API}/sales/access?userId=${encodeURIComponent(userId)}`,
    { headers },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    companyIds?: unknown;
    includeUnassigned?: unknown;
  };
  if (!Array.isArray(data.companyIds)) return null;
  return {
    companyIds: data.companyIds.map((id) => String(id || "")).filter(Boolean),
    includeUnassigned: Boolean(data.includeUnassigned),
  };
}

async function accessFromMongo(token: string | null, userId: string) {
  const actorId = userIdFromAuthHeader(token);
  const client = await getMongoClient();
  const db = client.db();
  const users = db.collection<UserDoc>("users");
  const actor = await users.findOne({ _id: new ObjectId(actorId) });
  if (!actor) throw new Error("Not signed in");
  if (actor.role !== "Admin" && actorId !== userId) {
    throw new Error("Not allowed");
  }
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user || user.role !== "Sales") {
    throw new Error("No Sales Person Found");
  }
  const companies = await db
    .collection<CompanyDoc>("companies")
    .find({})
    .project({ name: 1 })
    .toArray();
  const stl = companies.find((company) => String(company.name || "").trim() === "STL");
  return resolveCatalogAccess(
    companyIds(user.field?.sales?.company),
    stl ? String(stl._id) : "",
  );
}

export async function salesCompanyAccessForUser(
  token: string | null,
  userId: string,
) {
  try {
    const remote = await accessFromRemote(token, userId);
    if (remote) return remote;
  } catch {
    /* Fall through to the database copy. */
  }
  return accessFromMongo(token, userId);
}
