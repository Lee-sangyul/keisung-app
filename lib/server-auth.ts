import { createClient } from "@supabase/supabase-js";
import type { Profile } from "./supabase";
export function serviceClient() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key) throw new Error("Server configuration is missing");
 return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
export async function authenticate(request: Request) {
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token) return null;
 const service=serviceClient();
 const {data:{user},error}=await service.auth.getUser(token);
 if(error || !user) return null;
 const {data:profile,error:dbError}=await service.from("profiles").select("*").eq("id",user.id).single();
 if(dbError || !profile || profile.disabled) return null;
 return {service,user,profile:profile as Profile};
}
export const jsonError=(message:string,status:number)=>Response.json({error:message},{status});
