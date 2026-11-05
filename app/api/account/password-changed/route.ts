import { authenticate, jsonError } from "@/lib/server-auth";
export const runtime="nodejs";
export async function POST(request:Request){
 try {
  const ctx=await authenticate(request);
  if(!ctx)return jsonError("인증이 필요합니다.",401);
  if(!ctx.profile.must_change_password)return jsonError("초기 비밀번호 변경 대상이 아닙니다.",409);
  const body=await request.json().catch(()=>null);
  const password=body?.password;
  if(typeof password!=="string"||password.length<12||password.length>128)return jsonError("새 비밀번호는 12~128자여야 합니다.",400);
  const {error:authError}=await ctx.service.auth.admin.updateUserById(ctx.user.id,{password});
  if(authError)return jsonError("비밀번호 변경에 실패했습니다.",500);
  const {error:dbError}=await ctx.service.from("profiles").update({must_change_password:false}).eq("id",ctx.user.id);
  if(dbError)return jsonError("비밀번호는 변경됐지만 계정 상태 갱신에 실패했습니다. 관리자에게 문의해 주세요.",500);
  return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return jsonError("서버 오류",500);}
}
