import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { authenticate, jsonError } from "@/lib/server-auth";
import { hashStaffToken, isStaffRole, staffIdEnabled, STAFF_QR_TTL_MS } from "@/lib/staff-id";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store, private", "Pragma": "no-cache" };

export async function POST(request: Request) {
  try {
    if (!staffIdEnabled()) return jsonError("교직원증 기능이 비활성화되어 있습니다.", 503);
    const ctx = await authenticate(request);
    if (!ctx) return jsonError("로그인이 필요합니다.", 401);
    if (!isStaffRole(ctx.profile.role) || ctx.profile.must_change_password) {
      return jsonError("교직원 계정만 QR을 발급할 수 있습니다.", 403);
    }

    const { error: revokeError } = await ctx.service
      .from("staff_id_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", ctx.user.id)
      .is("consumed_at", null);
    if (revokeError) return jsonError("기존 QR 폐기에 실패했습니다. DB 설정을 확인하세요.", 500);

    const token = "KSSTAFF1:" + randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + STAFF_QR_TTL_MS).toISOString();
    const { error } = await ctx.service.from("staff_id_challenges").insert({
      user_id: ctx.user.id,
      token_hash: hashStaffToken(token),
      expires_at: expiresAt,
    });
    if (error) return jsonError("교직원증 QR 저장에 실패했습니다. DB 설정을 확인하세요.", 500);

    const svg = await QRCode.toString(token, {
      type: "svg",
      margin: 2,
      width: 280,
      errorCorrectionLevel: "M",
      color: { dark: "#17345c", light: "#ffffff" },
    });
    return Response.json({ svg, expiresAt, ttlSeconds: 45 }, { headers: privateHeaders });
  } catch {
    return jsonError("교직원증 발급 중 서버 오류가 발생했습니다.", 500);
  }
}
