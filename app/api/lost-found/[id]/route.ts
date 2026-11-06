import {authenticate,jsonError} from "@/lib/server-auth";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store, private"};
type RequestContext={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:RequestContext){
 try{
  const ctx=await authenticate(request);
  if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(!["admin","superadmin"].includes(ctx.profile.role)||ctx.profile.must_change_password)
   return jsonError("관리자만 분실물 상태를 변경할 수 있습니다.",403);
  const {id}=await params;
  if(!/^[a-f\d-]{36}$/i.test(id))return jsonError("잘못된 분실물 ID",400);
  const body=await request.json().catch(()=>null);
  if(body?.status!=="returned"&&body?.status!=="available")return jsonError("올바른 상태를 선택하세요.",400);
  const status=body.status as "returned"|"available";
  const {data,error}=await ctx.service.from("lost_found_items")
   .update({status,returned_at:status==="returned"?new Date().toISOString():null})
   .eq("id",id).select("id").maybeSingle();
  if(error)return jsonError("상태 변경 실패",500);
  if(!data)return jsonError("항목을 찾을 수 없습니다.",404);
  return Response.json({ok:true},{headers});
 }catch{return jsonError("분실물 상태 변경 오류",500);}
}
