import { profileWithSharjahPermit, toDateInput, type HrFileValue } from "./hr-profile";
import {
  getHrStaffMember,
  updateHrStaff,
  type HrFileRef,
} from "./stl-features-api";

export type SharjahPermitState = {
  expiry: string;
  file: HrFileValue;
};

export const emptySharjahPermit = (): SharjahPermitState => ({
  expiry: "",
  file: null,
});

export async function loadSharjahPermit(
  adminUserId: string,
  personId: string,
): Promise<SharjahPermitState | null> {
  try {
    const record = await getHrStaffMember(adminUserId, personId);
    const file = record.hrProfile?.sharjahPermitCopy;
    return {
      expiry: toDateInput(record.hrProfile?.sharjahPermitExpiry),
      file: file?.key ? file : null,
    };
  } catch (error) {
    const missing =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 404;
    return missing ? emptySharjahPermit() : null;
  }
}

export async function saveSharjahPermit(input: {
  adminUserId: string;
  personId: string;
  scope: "stl" | "shmp";
  permit: SharjahPermitState;
  fallbackName?: string;
}) {
  const file: HrFileRef | null = input.permit.file?.key
    ? {
        key: input.permit.file.key,
        fileName: input.permit.file.fileName,
        contentType: input.permit.file.contentType,
      }
    : null;
  let payload: Record<string, unknown>;
  try {
    const existing = await getHrStaffMember(input.adminUserId, input.personId);
    payload = profileWithSharjahPermit(
      existing.hrProfile,
      input.permit.expiry,
      file,
      input.fallbackName || existing.name || "",
      input.scope,
    );
  } catch (error) {
    const missing =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 404;
    if (!missing) throw error;
    payload = {
      sharjahPermitExpiry: input.permit.expiry,
      sharjahPermitCopy: file,
    };
  }
  return updateHrStaff(input.adminUserId, input.personId, payload, {
    enforceDocuments: false,
    scope: input.scope,
  });
}

export function createdRecordId(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const row = result as { _id?: unknown; id?: unknown; user?: unknown };
  if (typeof row._id === "string" && row._id) return row._id;
  if (typeof row.id === "string" && row.id) return row.id;
  if (row.user && typeof row.user === "object") {
    const user = row.user as { _id?: unknown; id?: unknown };
    if (typeof user._id === "string" && user._id) return user._id;
    if (typeof user.id === "string" && user.id) return user.id;
  }
  return "";
}
