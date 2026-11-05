import { randomBytes } from "node:crypto";
import { adminContext, audit, noStore } from "@/lib/admin";
import { accountEmail } from "@/lib/supabase";
import { MAX_STUDENT_IMPORT_BATCH, type StudentImportRow, validateStudentRows } from "@/lib/bulk-students";
import { jsonError } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

type Created = StudentImportRow & { temporaryPassword: string };
type Failed = { index: number; username: string; error: string };

export async function POST(request: Request) {
  try {
    const { ctx, error } = await adminContext(request);
    if (error) return error;
    if (!ctx) return jsonError("관리 권한이 없습니다.", 403);
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > MAX_STUDENT_IMPORT_BATCH) {
      return jsonError("한 번에 1~20명의 학생만 등록할 수 있습니다.", 400);
    }
    const rows = body.rows as StudentImportRow[];
    const issues = validateStudentRows(rows);
    if (issues.length) return Response.json({ error: "명단의 입력값을 확인해 주세요.", issues }, { status: 400, headers: noStore });

    const usernames = rows.map(r => r.username);
    const grades = [...new Set(rows.map(r => r.grade))];
    const classes = [...new Set(rows.map(r => r.classNumber))];
    const numbers = [...new Set(rows.map(r => r.studentNumber))];
    // Check existing IDs and class slots before provisioning; unlike client preview this is authoritative.
    const [usedNames, usedSlots] = await Promise.all([
      ctx.service.from("profiles").select("username").in("username", usernames),
      ctx.service.from("profiles").select("grade,class_number,student_number")
        .eq("role", "student").in("grade", grades)
        .in("class_number", classes).in("student_number", numbers).limit(1001)
    ]);
    if (usedNames.error || usedSlots.error) return jsonError("중복 확인을 수행할 수 없습니다.", 500);
    if ((usedSlots.data?.length || 0) >= 1001) return jsonError("학적 조회 범위가 너무 큽니다. 더 작은 묶음으로 재시도해 주세요.", 409);

    const existingNames = new Set((usedNames.data || []).map(row => row.username));
    const existingSlots = new Set((usedSlots.data || []).map(row => `${row.grade}/${row.class_number}/${row.student_number}`));
    const created: Created[] = [], failed: Failed[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const slot = `${row.grade}/${row.classNumber}/${row.studentNumber}`;
      if (existingNames.has(row.username) || existingSlots.has(slot)) {
        failed.push({ index, username: row.username, error: existingNames.has(row.username) ? "이미 존재하는 ID" : "이미 등록된 학년·반·번호" });
        continue;
      }
      const temporaryPassword = randomBytes(24).toString("base64url");
      const { data, error: authError } = await ctx.service.auth.admin.createUser({
        email: accountEmail(row.username),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { username: row.username, display_name: row.displayName },
      });
      if (authError || !data.user) {
        failed.push({ index, username: row.username, error: "인증 계정 생성 실패(중복 또는 설정 확인)" });
        continue;
      }
      const { error: profileError } = await ctx.service.from("profiles").insert({
        id: data.user.id, username: row.username, display_name: row.displayName,
        grade: row.grade, class_number: row.classNumber, student_number: row.studentNumber,
        role: "student", disabled: false, must_change_password: true,
      });
      if (profileError) {
        const { error: rollbackError } = await ctx.service.auth.admin.deleteUser(data.user.id);
        failed.push({ index, username: row.username, error: rollbackError ? "프로필 저장 실패 · 관리자 확인 필요" : "프로필 저장 실패(생성 취소됨)" });
        continue;
      }
      if (!(await audit(ctx.service, ctx.user.id, data.user.id, "create_account"))) {
        const { error: rollbackError } = await ctx.service.auth.admin.deleteUser(data.user.id);
        failed.push({ index, username: row.username, error: rollbackError ? "감사 기록 실패 · 관리자 확인 필요" : "감사 기록 실패(생성 취소됨)" });
        continue;
      }
      existingNames.add(row.username);
      existingSlots.add(slot);
      created.push({ ...row, temporaryPassword });
    }
    return Response.json({ created, failed, processed: rows.length }, { headers: noStore });
  } catch {
    return jsonError("일괄 학생 등록 중 서버 오류가 발생했습니다.", 500);
  }
}
