import {authenticate,jsonError} from "@/lib/server-auth";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
const authorized=async(request:Request,id:string)=>{
 const ctx=await authenticate(request);
 if(!ctx)return {error:jsonError("로그인이 필요합니다.",401),ctx:null,item:null};
 if(ctx.profile.must_change_password||!["teacher","admin","superadmin"].includes(ctx.profile.role))return {error:jsonError("권한이 없습니다.",403),ctx:null,item:null};
 if(!/^[0-9a-f-]{36}$/i.test(id))return {error:jsonError("잘못된 ID",400),ctx:null,item:null};
 const {data}=await ctx.service.from("announcements").select("id,author_id").eq("id",id).single();
 if(!data)return {error:jsonError("공지사항을 찾을 수 없습니다.",404),ctx:null,item:null};
 if(ctx.profile.role==="teacher"&&data.author_id!==ctx.user.id)return {error:jsonError("본인이 작성한 공지만 관리할 수 있습니다.",403),ctx:null,item:null};
 return {ctx,item:data,error:null};
};
export async function PATCH(request:Request,{params}:Context){
 try{
 const {id}=await params;const {ctx,error}=await authorized(request,id);if(error||!ctx)return error;
 const body=await request.json().catch(()=>null);
 const title=typeof body?.title==="string"?body.title.trim():"";
 const text=typeof body?.body==="string"?body.body.trim():"";
 if(!title||title.length>150||!text||text.length>10000||!["all","student","teacher"].includes(body?.audience)||typeof body?.published!=="boolean"||typeof body?.pinned!=="boolean")return jsonError("잘못된 내용",400);
 const {error:dbError}=await ctx.service.from("announcements").update({title,body:text,audience:body.audience,published:body.published,pinned:ctx.profile.role==="teacher"?false:body.pinned,updated_at:new Date().toISOString()}).eq("id",id);
 if(dbError)return jsonError("공지 수정 실패",500);
 return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return jsonError("서버 오류",500);}
}
export async function DELETE(request:Request,{params}:Context){
 try{
 const {id}=await params;const {ctx,error}=await authorized(request,id);if(error||!ctx)return error;
 const {error:dbError}=await ctx.service.from("announcements").delete().eq("id",id);
 if(dbError)return jsonError("공지 삭제 실패",500);
 return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return jsonError("서버 오류",500);}
}
