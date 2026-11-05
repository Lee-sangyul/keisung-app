import {randomBytes} from "node:crypto";
import {adminContext,audit,noStore} from "@/lib/admin";
import {jsonError} from "@/lib/server-auth";
export const runtime="nodejs";
type Params={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Params) {
 try {
  const {ctx,error}=await adminContext(request);if(error||!ctx)return error;
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("잘못된 계정 ID",400);
  const body=await request.json().catch(()=>null);
  if(!body||!["disable","enable","reset_password"].includes(body.action))return jsonError("지원되지 않는 작업",400);
  const action=body.action as "disable"|"enable"|"reset_password";
  if(id===ctx.user.id)return jsonError("자신의 계정은 여기서 변경할 수 없습니다.",403);
  const {data:target,error:lookupError}=await ctx.service.from("profiles").select("id,role,disabled").eq("id",id).single();
  if(lookupError||!target)return jsonError("계정을 찾을 수 없습니다.",404);
  if(target.role==="superadmin"||(target.role==="admin"&&ctx.profile.role!=="superadmin"))
   return jsonError("해당 계정을 관리할 권한이 없습니다.",403);
  if(action==="reset_password") {
   if(target.disabled)return jsonError("비활성화된 계정은 먼저 활성화해 주세요.",409);
   const temporaryPassword=randomBytes(24).toString("base64url");
   const {error:authError}=await ctx.service.auth.admin.updateUserById(id,{password:temporaryPassword});
   if(authError)return jsonError("비밀번호 초기화에 실패했습니다.",500);
   const {error:dbError}=await ctx.service.from("profiles").update({must_change_password:true}).eq("id",id);
   if(dbError)return jsonError("비밀번호는 초기화됐지만 상태 저장에 실패했습니다. 관리자 확인이 필요합니다.",500);
   if(!await audit(ctx.service,ctx.user.id,id,"reset_password"))return jsonError("비밀번호가 초기화됐으나 감사 로그 기록에 실패했습니다. 임시 비밀번호를 전달하지 말고 다시 초기화해 주세요.",500);
   return Response.json({ok:true,temporaryPassword},{headers:noStore});
  }
  if(target.disabled===(action==="disable"))return jsonError("이미 요청한 상태입니다.",409);
  // Disable access in the application and invalidate refresh tokens. An already-issued JWT
  // may remain valid until expiry; every privileged app API re-checks profiles.disabled.
  const {error:dbError}=await ctx.service.from("profiles").update({disabled:action==="disable"}).eq("id",id);
  if(dbError)return jsonError("계정 상태 변경 실패",500);
  if(action==="disable") {
   const {error:banError}=await ctx.service.auth.admin.updateUserById(id,{ban_duration:"876000h"});
   if(banError){await ctx.service.from("profiles").update({disabled:false}).eq("id",id);return jsonError("인증 계정 중지 실패",500);}
  } else {
   const {error:unbanError}=await ctx.service.auth.admin.updateUserById(id,{ban_duration:"none"});
   if(unbanError){await ctx.service.from("profiles").update({disabled:true}).eq("id",id);return jsonError("인증 계정 복구 실패",500);}
  }
  if(!await audit(ctx.service,ctx.user.id,id,action))return jsonError("계정 상태는 변경됐지만 감사 기록이 실패했습니다. 관리자 확인이 필요합니다.",500);
  return Response.json({ok:true},{headers:noStore});
 } catch {return jsonError("서버 오류",500);}
}
