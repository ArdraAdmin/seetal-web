import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import {
  apiModuleKeysForAccess,
  environmentsForAccess,
  validateCustomUserInput,
  type CustomAccess,
  type CustomUserRecord,
} from "../custom-users";
import { getMongoClient } from "./mongo";
import { userIdFromAuthHeader } from "./password";

const CUSTOM_COLLECTION = "customUsers";

type UserDoc = {
  _id: ObjectId;
  name?: string;
  email?: string;
  role?: string;
  customUser?: boolean;
  password?: string;
  mobileNumber?: string;
  environments?: string[];
  moduleAccess?: string[];
  field?: { admin?: { isSuperAdmin?: boolean } };
  createdAt?: Date;
  updatedAt?: Date;
};

type CustomDoc = {
  _id: ObjectId;
  userId: ObjectId;
  companies: CustomAccess["companies"];
  modules: CustomAccess["modules"];
  createdAt: Date;
  updatedAt: Date;
};

export class CustomUserError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "CustomUserError";
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asRecord(doc: UserDoc, access: CustomDoc): CustomUserRecord {
  return {
    id: String(doc._id),
    name: String(doc.name || ""),
    email: String(doc.email || ""),
    companies: access.companies,
    modules: access.modules,
  };
}

async function db() {
  const client = await getMongoClient();
  return client.db();
}

async function actor(token: string | null) {
  let actorId = "";
  try {
    actorId = userIdFromAuthHeader(token);
  } catch {
    throw new CustomUserError("Not signed in", 401);
  }
  const database = await db();
  const users = database.collection<UserDoc>("users");
  const custom = database.collection<CustomDoc>(CUSTOM_COLLECTION);
  const user = await users.findOne({ _id: new ObjectId(actorId) });
  if (!user || user.role !== "Admin") {
    throw new CustomUserError("Not allowed", 403);
  }
  const managed = await custom.findOne({ userId: user._id });
  if (user.customUser === true || managed) {
    throw new CustomUserError("Not allowed", 403);
  }
  return { users, custom, actorId: user._id };
}

async function emailTaken(
  users: Awaited<ReturnType<typeof actor>>["users"],
  email: string,
  exceptId?: ObjectId,
) {
  const existing = await users.findOne({
    email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  return Boolean(existing);
}

function userFields(name: string, email: string, access: CustomAccess) {
  return {
    name,
    email,
    role: "Admin",
    customUser: true,
    mobileNumber: "",
    environments: environmentsForAccess(access),
    moduleAccess: apiModuleKeysForAccess(access),
    field: { admin: { isSuperAdmin: false } },
  };
}

export async function listCustomUsers(token: string | null): Promise<CustomUserRecord[]> {
  const { users, custom } = await actor(token);
  const links = await custom.find().toArray();
  if (links.length === 0) return [];
  const people = await users
    .find({ _id: { $in: links.map((link) => link.userId) } })
    .project<UserDoc>({ password: 0 })
    .toArray();
  const byId = new Map(people.map((person) => [String(person._id), person]));
  return links
    .flatMap((link) => {
      const person = byId.get(String(link.userId));
      return person ? [asRecord(person, link)] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCustomUser(
  token: string | null,
  id: string,
): Promise<CustomUserRecord> {
  const { users, custom } = await actor(token);
  if (!ObjectId.isValid(id)) throw new CustomUserError("User not found", 404);
  const userId = new ObjectId(id);
  const [person, link] = await Promise.all([
    users.findOne({ _id: userId }, { projection: { password: 0 } }),
    custom.findOne({ userId }),
  ]);
  if (!person || !link) throw new CustomUserError("User not found", 404);
  return asRecord(person, link);
}

export async function createCustomUser(
  token: string | null,
  input: unknown,
): Promise<CustomUserRecord> {
  const parsed = validateCustomUserInput(input, "create");
  if (!parsed.ok) throw new CustomUserError(parsed.error, 400);
  const { users, custom } = await actor(token);
  const { name, email, password, access } = parsed.value;
  if (await emailTaken(users, email)) {
    throw new CustomUserError("A user with this email already exists", 400);
  }
  const now = new Date();
  const hashed = await bcrypt.hash(password, 10);
  const userId = new ObjectId();
  await users.insertOne({
    _id: userId,
    ...userFields(name, email, access),
    password: hashed,
    createdAt: now,
    updatedAt: now,
  });
  try {
    await custom.insertOne({
      _id: new ObjectId(),
      userId,
      companies: access.companies,
      modules: access.modules,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    await users.deleteOne({ _id: userId });
    throw error;
  }
  return {
    id: String(userId),
    name,
    email,
    companies: access.companies,
    modules: access.modules,
  };
}

export async function updateCustomUser(
  token: string | null,
  id: string,
  input: unknown,
): Promise<CustomUserRecord> {
  const parsed = validateCustomUserInput(input, "update");
  if (!parsed.ok) throw new CustomUserError(parsed.error, 400);
  const { users, custom } = await actor(token);
  if (!ObjectId.isValid(id)) throw new CustomUserError("User not found", 404);
  const userId = new ObjectId(id);
  const existing = await users.findOne({ _id: userId });
  const link = await custom.findOne({ userId });
  if (!existing || !link) throw new CustomUserError("User not found", 404);
  const { name, email, password, access } = parsed.value;
  if (await emailTaken(users, email, userId)) {
    throw new CustomUserError("A user with this email already exists", 400);
  }
  const now = new Date();
  const set: Record<string, unknown> = {
    ...userFields(name, email, access),
    updatedAt: now,
  };
  if (password) set.password = await bcrypt.hash(password, 10);
  await users.updateOne({ _id: userId }, { $set: set });
  await custom.updateOne(
    { userId },
    {
      $set: {
        companies: access.companies,
        modules: access.modules,
        updatedAt: now,
      },
    },
  );
  return {
    id,
    name,
    email,
    companies: access.companies,
    modules: access.modules,
  };
}

export async function deleteCustomUser(token: string | null, id: string) {
  const { users, custom } = await actor(token);
  if (!ObjectId.isValid(id)) throw new CustomUserError("User not found", 404);
  const userId = new ObjectId(id);
  const [existing, link] = await Promise.all([
    users.findOne({ _id: userId }),
    custom.findOne({ userId }),
  ]);
  if (!existing || !link) throw new CustomUserError("User not found", 404);
  await custom.deleteOne({ userId });
  await users.deleteOne({ _id: userId });
}

export async function customAccessForToken(
  token: string | null,
): Promise<CustomAccess | null> {
  let actorId = "";
  try {
    actorId = userIdFromAuthHeader(token);
  } catch {
    throw new CustomUserError("Not signed in", 401);
  }
  if (!ObjectId.isValid(actorId)) return null;
  const database = await db();
  const user = await database.collection<UserDoc>("users").findOne({
    _id: new ObjectId(actorId),
  });
  if (!user) return null;
  const link = await database.collection<CustomDoc>(CUSTOM_COLLECTION).findOne({
    userId: user._id,
  });
  if (!link && user.customUser !== true) return null;
  if (!link) return { companies: [], modules: {} };
  return {
    companies: link.companies || [],
    modules: link.modules || {},
  };
}
