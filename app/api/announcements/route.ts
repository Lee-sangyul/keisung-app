import {authenticate,jsonError} from "@/lib/server-auth";
export const runtime="nodejs";
const noStore={"Cache-Control":"no-store"};
export async function GET(request:Request) {
 try{
  const ctx=await authenticate(request);
  if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(ctx.profile.must_change_password)return jsonError("비밀번호를 먼저 변경해 주세요.",403);
  const url=new URL(request.url);
  const manage=url.searchParams.get("manage")==="1";
  const writer=["teacher","admin","superadmin"].includes(ctx.profile.role);
  if(manage&&!writer)return jsonError("권한이 없습니다.",403);
  let q=ctx.service.from("announcements").select("id,title,body,audience,pinned,published,author_id,created_at,updated_at").order("pinned",{ascending:false}).order("created_at",{ascending:false}).limit(100);
  if(manage&&ctx.profile.role==="teacher")q=q.eq("author_id",ctx.user.id);
  if(!manage){q=q.eq("published",true);if(ctx.profile.role==="student")q=q.in("audience",["all","student"]);else if(ctx.profile.role==="teacher")q=q.in("audience",["all","teacher"]); }
  const {data,error}=await q;
  if(error)return jsonError("공지사항 DB 설정을 확인해 주세요.",500);
  return Response.json({announcements:data},{headers:noStore});
 }catch{return jsonError("공지사항 조회 오류",500);}
}
export async function POST(request:Request){
 try{
  const ctx=await authenticate(request);
  if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(ctx.profile.must_change_password||!["teacher","admin","superadmin"].includes(ctx.profile.role))return jsonError("작성 권한이 없습니다.",403);
  const body=await request.json().catch(()=>null);
  const title=typeof body?.title==="string"?body.title.trim():"";
  const text=typeof body?.body==="string"?body.body.trim():"";
  const audience=body?.audience;
  if(title.length<1||title.length>150||text.length<1||text.length>10000||!["all","student","teacher"].includes(audience)||typeof body?.pinned!=="boolean")return jsonError("내용을 확인해 주세요.",400);
  const pinned=ctx.profile.role==="teacher"?false:body.pinned;
  const {data,error}=await ctx.service.from("announcements").insert({title,body:text,audience,pinned,author_id:ctx.user.id,published:true}).select("id").single();
  if(error)return jsonError("공지 등록에 실패했습니다.",500);
  return Response.json({id:data.id},{status:201,headers:noStore});
 }catch{return jsonError("공지 작성 오류",500);}
}
