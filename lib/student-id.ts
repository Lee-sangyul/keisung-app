import { createHash } from "node:crypto";
export const ID_LIFETIME_MS=45_000;
export function hashToken(token:string) {
 return createHash("sha256").update(token,"utf8").digest("hex");
}
export function isTokenFormat(token:string){
 return /^KSID1:[A-Za-z0-9_-]{43}$/.test(token);
}
export function idFeatureEnabled(){return process.env.STUDENT_ID_ENABLED==="true";}
