import { createHash } from "node:crypto";

export const STAFF_QR_TTL_MS = 45_000;

export function staffIdEnabled(): boolean {
  return process.env.STAFF_ID_ENABLED === "true";
}

export function hashStaffToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isStaffToken(value: unknown): value is string {
  return typeof value === "string" && /^KSSTAFF1:[A-Za-z0-9_-]{43}$/.test(value);
}

export const staffRoles = ["teacher", "admin", "superadmin"] as const;
export function isStaffRole(role: string): boolean {
  return staffRoles.some((value) => value === role);
}
