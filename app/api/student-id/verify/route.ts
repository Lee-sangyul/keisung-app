import {authenticate,jsonError} from "@/lib/server-auth";
import {hashToken,idFeatureEnabled,isTokenFormat} from "@/lib/student-id";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store, private"};
export async function POST(request:Request){
 try{
  if(!idFeatureEnabled())return jsonError("검증 기능이 비활성화 상태입니다.",503);
  const ctx=await authenticate(request);
  if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(!["teacher","admin","superadmin"].includes(ctx.profile.role)||ctx.profile.must_change_password)return jsonError("교사·관리자만 검증할 수 있습니다.",403);
  const body=await request.json().catch(()=>null);
  const token=typeof body?.token==="string"?body.token.trim():"";
  if(!isTokenFormat(token))return jsonError("지원하지 않는 QR 형식입니다.",400);
  // Atomic single-use consumption; RPC is executable only by server service_role.
  const {data,error}=await ctx.service.rpc("consume_student_id_challenge",{p_hash:hashToken(token)});
  if(error)return jsonError("검증 DB 설정을 확인해 주세요.",500);
  const userId=Array.isArray(data)?data[0]?.verified_user_id:undefined;
  if(!userId)return jsonError("사용됐거나 만료된 QR입니다. 학생에게 새 QR을 요청하세요.",410);
  const {data:p,error:profileError}=await ctx.service.from("profiles").select("display_name,grade,class_number,student_number,role,disabled,must_change_password").eq("id",userId).single();
  if(profileError||!p||p.role!=="student"||p.disabled||p.must_change_password)return jsonError("유효하지 않은 학생 계정입니다.",403);
  return Response.json({valid:true,student:{name:p.display_name,grade:p.grade,classNumber:p.class_number,studentNumber:p.student_number},verifiedAt:new Date().toISOString(),notice:"개발용 계정 확인 결과이며 공식 신분 증명이 아닙니다."},{headers});
 }catch{return jsonError("검증 오류",500);}
}
