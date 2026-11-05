import { authenticate, jsonError } from "@/lib/server-auth";
import { hashStaffToken, isStaffRole, isStaffToken, staffIdEnabled } from "@/lib/staff-id";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store, private" };

export async function POST(request: Request) {
  try {
    if (!staffIdEnabled()) return jsonError("교직원증 검증 기능이 비활성화되어 있습니다.", 503);
    const ctx = await authenticate(request);
    if (!ctx) return jsonError("로그인이 필요합니다.", 401);
    if (!["admin", "superadmin"].includes(ctx.profile.role) || ctx.profile.must_change_password) {
      return jsonError("관리자 계정만 교직원증을 검증할 수 있습니다.", 403);
    }
    const data = await request.json().catch(() => null);
    const token = typeof data?.token === "string" ? data.token.trim() : null;
    if (!isStaffToken(token)) return jsonError("올바른 교직원증 QR이 아닙니다.", 400);

    const { data: consumed, error: consumedError } = await ctx.service
      .rpc("consume_staff_id_challenge", { p_hash: hashStaffToken(token) });
    if (consumedError) return jsonError("QR 검증 DB 설정을 확인하세요.", 500);
    const staffId: string | undefined = Array.isArray(consumed)
      ? consumed[0]?.verified_user_id
      : undefined;
    if (!staffId) return jsonError("사용했거나 만료된 QR입니다. 새 QR을 요청하세요.", 410);

    const { data: profile, error: profileError } = await ctx.service
      .from("profiles")
      .select("display_name,role,disabled,must_change_password")
      .eq("id", staffId)
      .single();
    if (profileError || !profile || !isStaffRole(profile.role) || profile.disabled || profile.must_change_password) {
      return jsonError("유효하지 않은 교직원 계정입니다.", 403);
    }

    const { error: auditError } = await ctx.service.from("staff_id_verifications").insert({
      verifier_id: ctx.user.id,
      staff_id: staffId,
    });
    if (auditError) return jsonError("QR은 소비됐지만 검증 이력 저장에 실패했습니다.", 500);

    const roleLabel: Record<string, string> = {
      teacher: "교사", admin: "관리자", superadmin: "시스템 관리자",
    };
    return Response.json({
      valid: true,
      staff: { name: profile.display_name, role: profile.role, roleLabel: roleLabel[profile.role] },
      verifiedAt: new Date().toISOString(),
      notice: "계성 스마트 개발용 계정 확인 결과입니다. 공식 교직원 신분증이 아닙니다.",
    }, { headers: privateHeaders });
  } catch {
    return jsonError("QR 검증 중 서버 오류가 발생했습니다.", 500);
  }
}
