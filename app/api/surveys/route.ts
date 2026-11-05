import {authenticate,jsonError} from "@/lib/server-auth";
export const runtime="nodejs";
const noStore={"Cache-Control":"no-store, private"};
function permitted(role:string,audience:string){return role==="admin"||role==="superadmin"||audience==="all"||audience===role;}
export async function GET(request:Request){
 try{
  const ctx=await authenticate(request);if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(ctx.profile.must_change_password)return jsonError("비밀번호 변경이 필요합니다.",403);
  const manager=["admin","superadmin"].includes(ctx.profile.role);
  const {data,error}=await ctx.service.from("surveys").select("id,title,question,options,audience,closes_at,closed,created_at").order("created_at",{ascending:false}).limit(60);
  if(error)return jsonError("설문 DB 설정이 필요합니다.",500);
  const visible=(data||[]).filter(s=>permitted(ctx.profile.role,s.audience));
  const ids=visible.map(s=>s.id as string);
  if(!ids.length)return Response.json({surveys:[]},{headers:noStore});
  const {data:part,error:partError}=await ctx.service.from("survey_participation").select("survey_id").eq("user_id",ctx.user.id).in("survey_id",ids);
  if(partError)return jsonError("응답 내역을 불러오지 못했어요.",500);
  const participated=new Set((part||[]).map(v=>v.survey_id));
  const resultIds=visible.filter(s=>manager||s.closed||new Date(s.closes_at).getTime()<=Date.now()).map(s=>s.id as string);
  let counts:Record<string,number[]>={};
  if(resultIds.length){
   const {data:totals,error:countError}=await ctx.service.rpc("survey_count_results",{p_ids:resultIds});
   if(countError)return jsonError("설문 집계 설정을 확인해 주세요.",500);
   for(const t of totals||[]){
     if(!counts[t.survey_id])counts[t.survey_id]=[];
     counts[t.survey_id][t.option_index]=Number(t.vote_count);
   }
  }
  return Response.json({surveys:visible.map(s=>({...s,participated:participated.has(s.id),results:resultIds.includes(s.id)?(s.options as string[]).map((_:string,i:number)=>counts[s.id]?.[i]||0):null}))},{headers:noStore});
 }catch{return jsonError("설문 조회 오류",500);}
}
export async function POST(request:Request){
 try{
  const ctx=await authenticate(request);if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(!["admin","superadmin"].includes(ctx.profile.role)||ctx.profile.must_change_password)return jsonError("관리자만 설문을 만들 수 있습니다.",403);
  const body=await request.json().catch(()=>null);
  const title=typeof body?.title==="string"?body.title.trim():"";
  const question=typeof body?.question==="string"?body.question.trim():"";
  const options=Array.isArray(body?.options)?body.options.map((s:unknown)=>typeof s==="string"?s.trim():null):[];
  const audience=body?.audience;
  const closesAt=Date.parse(body?.closesAt||"");
  if(title.length<1||title.length>120||question.length<1||question.length>500||options.length<2||options.length>6||options.some((s:string|null)=>!s||s.length>120)||new Set(options).size!==options.length||!["student","teacher","all"].includes(audience)||!Number.isFinite(closesAt)||closesAt<Date.now()+60_000||closesAt>Date.now()+365*86400_000)
   return jsonError("설문 제목·문항·선택지·마감 시간을 확인해 주세요.",400);
  const {data,error}=await ctx.service.from("surveys").insert({title,question,options,audience,closes_at:new Date(closesAt).toISOString(),created_by:ctx.user.id}).select("id").single();
  if(error)return jsonError("설문 저장에 실패했습니다. DB 설정을 확인해 주세요.",500);
  return Response.json({id:data.id},{status:201,headers:noStore});
 }catch{return jsonError("설문 저장 오류",500);}
}
