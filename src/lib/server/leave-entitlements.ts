import { ObjectId } from "mongodb";
import { getMongoClient } from "./mongo";
import { userIdFromAuthHeader } from "./password";

export type LeaveEntitlement = {
  annual: number;
  sick: number;
};

function asObjectId(id: unknown): ObjectId {
  const value = String(id ?? "").trim();
  if (!ObjectId.isValid(value)) throw new Error("Invalid user id");
  return new ObjectId(value);
}

async function requireAdmin(token: string | null) {
  const adminId = userIdFromAuthHeader(token);
  const client = await getMongoClient();
  const db = client.db();
  const admin = await db.collection("users").findOne({
    _id: new ObjectId(adminId),
  });
  if (!admin || admin.role !== "Admin") {
    throw new Error("Not allowed");
  }
  return { db, adminId };
}

function num(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function setPortalLeaveEntitlements(input: {
  token: string | null;
  userIds: string[];
  annualLeaveDays: number;
  sickLeaveDays: number;
}): Promise<{ updated: number }> {
  if (!Number.isFinite(input.annualLeaveDays) || input.annualLeaveDays < 0) {
    throw new Error("Annual leave days must be a non-negative number");
  }
  if (!Number.isFinite(input.sickLeaveDays) || input.sickLeaveDays < 0) {
    throw new Error("Sick leave days must be a non-negative number");
  }
  const ids = [...new Set(input.userIds.map((id) => String(id).trim()))].filter(
    Boolean,
  );
  if (ids.length === 0) throw new Error("Select at least one user");

  const { db } = await requireAdmin(input.token);
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map(asObjectId);
  if (objectIds.length === 0) return { updated: 0 };
  const year = new Date().getFullYear();
  const result = await db.collection("users").updateMany(
    { _id: { $in: objectIds }, role: { $in: ["Sales", "Supervisor"] } },
    {
      $set: {
        "hrProfile.annualLeaveDays": input.annualLeaveDays,
        "hrProfile.sickLeaveDays": input.sickLeaveDays,
        annualLeaveEntitlement: input.annualLeaveDays,
        sickLeaveEntitlement: input.sickLeaveDays,
        leaveYear: year,
      },
    },
  );
  return { updated: result.modifiedCount + result.matchedCount };
}

export async function getPortalLeaveEntitlements(input: {
  token: string | null;
  userIds: string[];
}): Promise<Record<string, LeaveEntitlement>> {
  const ids = [...new Set(input.userIds.map((id) => String(id).trim()))].filter(
    Boolean,
  );
  if (ids.length === 0) return {};
  const { db } = await requireAdmin(input.token);
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map(asObjectId);
  const rows = await db
    .collection("users")
    .find(
      { _id: { $in: objectIds } },
      {
        projection: {
          hrProfile: 1,
          annualLeaveEntitlement: 1,
          sickLeaveEntitlement: 1,
        },
      },
    )
    .toArray();

  const out: Record<string, LeaveEntitlement> = {};
  for (const row of rows) {
    const profile =
      row.hrProfile && typeof row.hrProfile === "object"
        ? (row.hrProfile as Record<string, unknown>)
        : {};
    const annual =
      num(profile.annualLeaveDays) ??
      num(row.annualLeaveEntitlement);
    const sick =
      num(profile.sickLeaveDays) ?? num(row.sickLeaveEntitlement);
    if (annual == null && sick == null) continue;
    out[String(row._id)] = {
      annual: annual ?? 0,
      sick: sick ?? 0,
    };
  }
  return out;
}
