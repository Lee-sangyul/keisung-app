import { createHash } from "node:crypto";
import { jsonError } from "./server-auth";
export const ID_LIFETIME_MS=45_000;
export function hashToken(token:string) {
 return createHash("sha256").update(token,"utf8").digest("hex");
}
export function isTokenFormat(token:string){
 return /^KSID1:[A-Za-z0-9_-]{43}$/.test(token);
}
export function idFeatureEnabled(){return process.env.STUDENT_ID_ENABLED==="true";}

export function studentIdDatabaseError(action: "발급" | "검증", code: string) {
  const configurationErrors = ["42501", "42P01", "42883", "PGRST202", "PGRST205"];
  console.error("Student ID database request failed", { action, code });
  if (configurationErrors.includes(code)) {
    return jsonError("학생증 DB 설정을 확인해 주세요. 관리자에게 문의하세요.", 503);
  }
  return jsonError(`학생증 QR ${action}에 실패했습니다.`, 500);
}
