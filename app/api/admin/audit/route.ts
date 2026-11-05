import {adminContext,noStore} from "@/lib/admin";
export const runtime="nodejs";
export async function GET(request:Request){
 try{const {ctx,error}=await adminContext(request);if(error||!ctx)return error;
 const {data,error:dbError}=await ctx.service.from("admin_audit_logs").select("id,actor_id,target_id,action,created_at").order("created_at",{ascending:false}).limit(60);
 if(dbError)return Response.json({error:"감사 로그를 읽을 수 없습니다. DB 업데이트를 확인하세요."},{status:500});
 return Response.json({logs:data},{headers:noStore});
 }catch{return Response.json({error:"서버 오류"},{status:500});}
}
