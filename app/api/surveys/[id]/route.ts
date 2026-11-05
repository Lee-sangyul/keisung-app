import {authenticate,jsonError} from "@/lib/server-auth";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const noStore={"Cache-Control":"no-store, private"};
export async function POST(request:Request,{params}:Ctx){
 try{
  const ctx=await authenticate(request);if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(ctx.profile.must_change_password)return jsonError("비밀번호 변경이 필요합니다.",403);
  const {id}=await params;
  if(!/^[a-f\d-]{36}$/i.test(id))return jsonError("잘못된 설문입니다.",400);
  const body=await request.json().catch(()=>null);
  const answer=body?.optionIndex;
  if(!Number.isInteger(answer)||answer<0||answer>5)return jsonError("선택지를 확인해 주세요.",400);
  const {data:survey,error}=await ctx.service.from("surveys").select("audience").eq("id",id).single();
  if(error||!survey)return jsonError("설문을 찾을 수 없습니다.",404);
  if(survey.audience!=="all"&&survey.audience!==ctx.profile.role&&!(survey.audience==="teacher"&&["admin","superadmin"].includes(ctx.profile.role)))return jsonError("응답 대상이 아닙니다.",403);
  const {data:ok,error:voteError}=await ctx.service.rpc("cast_survey_vote",{p_survey:id,p_user:ctx.user.id,p_option:answer});
  if(voteError)return jsonError("응답 DB 설정을 확인해 주세요.",500);
  if(!ok)return jsonError("마감되었거나 이미 응답한 설문입니다.",409);
  return Response.json({ok:true},{headers:noStore});
 }catch{return jsonError("설문 응답 오류",500);}
}
export async function PATCH(request:Request,{params}:Ctx){
 try{
  const ctx=await authenticate(request);if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(!["admin","superadmin"].includes(ctx.profile.role)||ctx.profile.must_change_password)return jsonError("관리 권한이 없습니다.",403);
  const {id}=await params;
  if(!/^[a-f\d-]{36}$/i.test(id))return jsonError("잘못된 설문입니다.",400);
  const body=await request.json().catch(()=>null);
  if(body?.action!=="close")return jsonError("설문은 마감만 할 수 있습니다.",400);
  const {error}=await ctx.service.from("surveys").update({closed:true}).eq("id",id).eq("closed",false);
  if(error)return jsonError("마감에 실패했어요.",500);
  return Response.json({ok:true},{headers:noStore});
 }catch{return jsonError("설문 관리 오류",500);}
}
