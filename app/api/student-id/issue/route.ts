import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { authenticate, jsonError } from "@/lib/server-auth";
import { hashToken, ID_LIFETIME_MS, idFeatureEnabled, studentIdDatabaseError } from "@/lib/student-id";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private", Pragma: "no-cache" };

export async function POST(request: Request) {
  try {
    if (!idFeatureEnabled()) return jsonError("학생증 기능이 아직 활성화되지 않았습니다.", 503);
    const ctx = await authenticate(request);
    if (!ctx) return jsonError("로그인이 필요합니다.", 401);
    if (ctx.profile.role !== "student" || ctx.profile.must_change_password) {
      return jsonError("학생 계정만 발급할 수 있습니다.", 403);
    }
    if (ctx.profile.grade == null || ctx.profile.class_number == null || ctx.profile.student_number == null) {
      return jsonError("학생 학적 정보가 등록되지 않았습니다. 관리자에게 문의하세요.", 409);
    }

    const payload = "KSID1:" + randomBytes(32).toString("base64url");
    const svg = await QRCode.toString(payload, {
      type: "svg",
      margin: 2,
      width: 280,
      errorCorrectionLevel: "M",
      color: { dark: "#152a50", light: "#ffffff" },
    });
    const { data: expiresAt, error } = await ctx.service.rpc("issue_student_id_challenge", {
      p_user_id: ctx.user.id,
      p_hash: hashToken(payload),
    });
    if (error) return studentIdDatabaseError("발급", error.code);

    return Response.json({ svg, expiresAt, ttlSeconds: ID_LIFETIME_MS / 1000 }, { headers });
  } catch {
    return jsonError("QR 발급 오류", 500);
  }
}
