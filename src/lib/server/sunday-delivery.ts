import { ObjectId, type Db } from "mongodb";
import { getMongoClient } from "./mongo";
import { userIdFromAuthHeader } from "./password";

const SUPER_ADMIN_EMAIL = "lav@shrseetal.com";
const SETTINGS_ID = "sundayDelivery";

type SettingsDoc = {
  _id: string;
  enabled?: boolean;
};

export async function readSundayDelivery(database?: Db): Promise<boolean> {
  const db = database ?? (await getMongoClient()).db();
  const doc = await db.collection<SettingsDoc>("appsettings").findOne({
    _id: SETTINGS_ID,
  });
  return doc?.enabled === true;
}

async function actorIsSuperAdmin(token: string | null) {
  const userId = userIdFromAuthHeader(token);
  const db = (await getMongoClient()).db();
  const user = await db.collection<{
    role?: string;
    email?: string;
    field?: { admin?: { isSuperAdmin?: boolean } };
  }>("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { role: 1, email: 1, field: 1 } },
  );
  const email = String(user?.email || "")
    .trim()
    .toLowerCase();
  const flagged = user?.field?.admin?.isSuperAdmin === true;
  return {
    userId,
    allowed:
      Boolean(user) &&
      user?.role === "Admin" &&
      (flagged || email === SUPER_ADMIN_EMAIL),
  };
}

export async function readSundayDeliveryForUser(token: string | null) {
  const actor = await actorIsSuperAdmin(token);
  return {
    sundayDelivery: await readSundayDelivery(),
    canEdit: actor.allowed,
  };
}

export async function writeSundayDelivery(token: string | null, enabled: boolean) {
  const actor = await actorIsSuperAdmin(token);
  if (!actor.allowed) {
    throw new Error("Not allowed");
  }
  const userId = actor.userId;
  const db = (await getMongoClient()).db();
  await db.collection<SettingsDoc>("appsettings").updateOne(
    { _id: SETTINGS_ID },
    {
      $set: {
        enabled,
        updatedAt: new Date(),
        updatedBy: userId,
      },
    },
    { upsert: true },
  );
  return enabled;
}
