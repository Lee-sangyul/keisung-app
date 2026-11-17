import { authenticate, jsonError } from "@/lib/server-auth";
import { EQUIPMENT_CODE, EQUIPMENT_TYPES, NEXT_STATUS, REPORT_ID, REPORT_STATUS, type ReportStatus } from "@/lib/equipment";

const headers = { "Cache-Control": "no-store, private" };
const reportFields = "id,asset_code,category,location,description,status,created_at,updated_at";
const PAGE_SIZE = 30;

async function equipmentContext(request: Request) {
  const ctx = await authenticate(request);
  if (!ctx) return { error: jsonError("로그인이 필요합니다.", 401) };
  if (ctx.profile.must_change_password) return { error: jsonError("먼저 비밀번호를 변경해 주세요.", 403) };

  const admin = ctx.profile.role === "admin" || ctx.profile.role === "superadmin";
  if (admin) return { ctx, admin, canHandle: true };

  const { data, error } = await ctx.service.from("equipment_report_handlers")
    .select("user_id").eq("user_id", ctx.user.id).maybeSingle();
  if (error) return { error: jsonError("신고 권한을 조회할 수 없습니다.", 503) };
  return { ctx, admin, canHandle: Boolean(data) };
}

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const access = await equipmentContext(request);
  if (!access.ctx) return access.error;
  const { ctx, admin, canHandle } = access;
  const params = new URL(request.url).searchParams;
  const assetCode = params.get("asset");
  if (assetCode !== null) {
    if (!EQUIPMENT_CODE.test(assetCode)) return jsonError("기자재 코드를 확인해 주세요.", 400);
    const { data, error } = await ctx.service.from("equipment_assets")
      .select("code,category,location").eq("code", assetCode).maybeSingle();
    if (error) return jsonError("기자재를 조회할 수 없습니다.", 503);
    if (!data) return jsonError("등록된 기자재를 찾을 수 없습니다.", 404);
    return Response.json({ asset: data }, { headers });
  }

  const page = Number(params.get("page") ?? "1");
  const status = params.get("status");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      (status && !Object.hasOwn(REPORT_STATUS, status))) {
    return jsonError("조회 조건을 확인해 주세요.", 400);
  }
  let query = ctx.service.from("equipment_reports").select(reportFields);
  if (!canHandle || params.get("mine") === "true") query = query.eq("reporter_id", ctx.user.id);
  if (status) query = query.eq("status", status);
  const start = (page - 1) * PAGE_SIZE;
  const { data, error } = await query.order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(start, start + PAGE_SIZE);
  if (error) return jsonError("신고 목록을 조회할 수 없습니다. 기자재 DB 설정을 확인해 주세요.", 503);
  return Response.json({ reports: data.slice(0, PAGE_SIZE), hasMore: data.length > PAGE_SIZE, admin, canHandle }, { headers });
}

export async function POST(request: Request) {
  const access = await equipmentContext(request);
  if (!access.ctx) return access.error;
  const { ctx, admin } = access;
  const body = await request.json().catch(() => null);
  let category = textField(body?.category);
  let location = textField(body?.location);
  const code = textField(body?.code).toUpperCase();
  const registeringAsset = body?.kind === "asset";

  if (registeringAsset && !admin) return jsonError("관리자만 기자재를 등록할 수 있습니다.", 403);
  if (code || registeringAsset) {
    if (!EQUIPMENT_CODE.test(code)) return jsonError("기자재 코드는 영문·숫자·하이픈 3~32자로 입력해 주세요.", 400);
  }
  if (code && !registeringAsset) {
    const { data, error } = await ctx.service.from("equipment_assets")
      .select("category,location").eq("code", code).maybeSingle();
    if (error) return jsonError("기자재를 조회할 수 없습니다.", 503);
    if (!data) return jsonError("등록된 기자재를 찾을 수 없습니다.", 404);
    ({ category, location } = data);
  }
  if (!EQUIPMENT_TYPES.some(type => type === category) || !location || location.length > 80) {
    return jsonError("기자재 종류와 위치를 확인해 주세요.", 400);
  }

  if (registeringAsset) {
    const { error } = await ctx.service.from("equipment_assets").insert({ code, category, location });
    if (error?.code === "23505") return jsonError("이미 등록된 기자재 코드입니다.", 409);
    if (error) return jsonError("기자재를 등록할 수 없습니다.", 503);
    return Response.json({ asset: { code, category, location } }, { status: 201, headers });
  }

  const description = textField(body?.description);
  if (!description || description.length > 500) return jsonError("고장 증상을 1~500자로 입력해 주세요.", 400);
  const { error } = await ctx.service.from("equipment_reports").insert({
    reporter_id: ctx.user.id,
    asset_code: code || null,
    category,
    location,
    description,
  });
  if (error) return jsonError("신고를 접수할 수 없습니다.", 503);
  return Response.json({ ok: true }, { status: 201, headers });
}

export async function PATCH(request: Request) {
  const access = await equipmentContext(request);
  if (!access.ctx) return access.error;
  const { ctx, canHandle } = access;
  if (!canHandle) return jsonError("신고 처리 권한이 없습니다.", 403);

  const body = await request.json().catch(() => null);
  const id = textField(body?.id);
  const from = textField(body?.status);
  if (!REPORT_ID.test(id) || !Object.hasOwn(NEXT_STATUS, from)) {
    return jsonError("변경할 신고와 현재 상태를 확인해 주세요.", 400);
  }
  const status = NEXT_STATUS[from as ReportStatus];
  const { data, error } = await ctx.service.from("equipment_reports")
    .update({ status, updated_at: new Date().toISOString(), updated_by: ctx.user.id })
    .eq("id", id).eq("status", from).select("id,status,updated_at").maybeSingle();
  if (error) return jsonError("신고 상태를 변경할 수 없습니다.", 503);
  if (!data) return jsonError("신고가 이미 변경됐거나 존재하지 않습니다. 목록을 새로고침해 주세요.", 409);
  return Response.json({ report: data }, { headers });
}
