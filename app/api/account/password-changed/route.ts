import { authenticate, jsonError } from "@/lib/server-auth";
export const runtime="nodejs";
export async function POST(request:Request){try{const ctx=await authenticate(request);if(!ctx)return jsonError("인증이 필요합니다.",401);const {error}=await ctx.service.from("profiles").update({must_change_password:false}).eq("id",ctx.user.id);if(error)return jsonError("변경 상태 저장 실패",500);return Response.json({ok:true});}catch{return jsonError("서버 설정 오류",500);}}
