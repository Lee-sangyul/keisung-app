import { authenticate, jsonError } from "@/lib/server-auth";
export async function adminContext(request: Request) {
 const ctx=await authenticate(request);
 if(!ctx) return { error:jsonError("로그인이 필요합니다.",401), ctx:null };
 if(!["admin","superadmin"].includes(ctx.profile.role)||ctx.profile.must_change_password)
  return {error:jsonError("관리 권한이 없습니다.",403),ctx:null};
 return {ctx,error:null};
}
export async function audit(service: ReturnType<typeof import("@/lib/server-auth").serviceClient>,actorId:string,targetId:string,action:string) {
 const {error}=await service.from("admin_audit_logs").insert({actor_id:actorId,target_id:targetId,action});
 if(error) { console.error("Audit insert failed:",error.code); return false; }
 return true;
}
export const noStore={"Cache-Control":"no-store"};
