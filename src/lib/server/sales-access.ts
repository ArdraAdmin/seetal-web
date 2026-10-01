import { ObjectId } from "mongodb";
import type { ProfileUser } from "@/lib/types";
import { companyIds, salesField } from "@/lib/profiles";
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
    companyNames: Array.isArray((data as { companyNames?: unknown }).companyNames)
      ? ((data as { companyNames: unknown[] }).companyNames || [])
          .map((name) => String(name || "").trim())
          .filter(Boolean)
      : [],
    includeUnassigned: false,
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
  return resolveCatalogAccess(
    companyIds(user.field?.sales?.company),
    companies.map((company) => ({
      _id: String(company._id),
      name: company.name,
    })),
  );
}

async function accessFromRemoteProfile(token: string | null, userId: string) {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", token);
    headers.set("auth-token", token);
  }
  const userRes = await fetch(
    `${REMOTE_API}/admin/read/sales/${encodeURIComponent(userId)}`,
    { headers },
  );
  if (!userRes.ok) return null;
  const data = (await userRes.json()) as { user?: unknown } | unknown;
  const rawUser = Array.isArray((data as { user?: unknown }).user)
    ? (data as { user: unknown[] }).user[0]
    : (data as { user?: unknown }).user || data;
  if (!rawUser || typeof rawUser !== "object") return null;
  const assigned = companyIds(salesField(rawUser as ProfileUser).company);
  const companiesRes = await fetch(`${REMOTE_API}/admin/company`, { headers });
  const companies: { _id: string; name?: string }[] = [];
  if (companiesRes.ok) {
    const data = (await companiesRes.json()) as { _id?: string; name?: string }[];
    if (Array.isArray(data)) {
      for (const company of data) {
        if (company?._id) companies.push({ _id: String(company._id), name: company.name });
      }
    }
  }
  return resolveCatalogAccess(assigned, companies);
}

export async function salesCompanyAccessForUser(
  token: string | null,
  userId: string,
) {
  try {
    const remote = await accessFromRemote(token, userId);
    if (remote) return remote;
  } catch {
    /* Fall through. */
  }
  try {
    const fromProfile = await accessFromRemoteProfile(token, userId);
    if (fromProfile) return fromProfile;
  } catch {
    /* Fall through to the database copy. */
  }
  return accessFromMongo(token, userId);
}
