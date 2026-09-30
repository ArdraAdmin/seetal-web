import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("Database is not configured");
    this.name = "DatabaseNotConfiguredError";
  }
}

function mongoUri(): string {
  const fromEnv = process.env.MONGODB_URI || process.env.DB_URI;
  if (fromEnv) return fromEnv;

  const constantPath = path.resolve(
    process.cwd(),
    "../STLAPI/lib/constant.js",
  );
  try {
    const text = fs.readFileSync(constantPath, "utf8");
    const match = text.match(/const DB_URI = "([^"]+)"/);
    if (match?.[1]) return match[1];
  } catch {
    // Local STLAPI checkout is optional on hosted deploys.
  }

  throw new DatabaseNotConfiguredError();
}

export function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    clientPromise = new MongoClient(mongoUri()).connect();
  }
  return clientPromise;
}

export function isDatabaseNotConfigured(error: unknown): boolean {
  return (
    error instanceof DatabaseNotConfiguredError ||
    (error instanceof Error && error.message === "Database is not configured")
  );
}
