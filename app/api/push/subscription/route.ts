import {authenticate,jsonError} from "@/lib/server-auth";
import {pushConfigured,validPushEndpoint} from "@/lib/push";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store, private"};
export async function GET(request:Request){
 try{
  const ctx=await authenticate(request);if(!ctx)return jsonError("로그인이 필요합니다.",401);
  const {data,error}=await ctx.service.from("push_subscriptions").select("id").eq("user_id",ctx.user.id).limit(1);
  if(error)return jsonError("알림 DB 설정이 필요합니다.",500);
  return Response.json({configured:pushConfigured(),publicKey:pushConfigured()?process.env.VAPID_PUBLIC_KEY:null,subscribed:Boolean(data?.length)},{headers});
 }catch{return jsonError("구독 조회 오류",500);}
}
export async function POST(request:Request){
 try{
  if(!pushConfigured())return jsonError("푸시 알림이 아직 활성화되지 않았습니다.",503);
  const ctx=await authenticate(request);if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(ctx.profile.must_change_password)return jsonError("비밀번호를 먼저 변경해 주세요.",403);
  const body=await request.json().catch(()=>null);
  const endpoint=body?.endpoint;
  const p256dh=body?.keys?.p256dh,authKey=body?.keys?.auth;
  if(typeof endpoint!=="string"||endpoint.length>2048||!validPushEndpoint(endpoint)
   ||typeof p256dh!=="string"||p256dh.length<40||p256dh.length>300
   ||typeof authKey!=="string"||authKey.length<10||authKey.length>200)
  return jsonError("브라우저가 제공한 푸시 구독 정보가 유효하지 않습니다.",400);
  const {error}=await ctx.service.from("push_subscriptions")
   .upsert({user_id:ctx.user.id,endpoint,p256dh,auth_key:authKey},{onConflict:"endpoint"});
  if(error)return jsonError("알림 구독 저장 실패",500);
  return Response.json({ok:true},{headers});
 }catch{return jsonError("알림 구독 오류",500);}
}
export async function DELETE(request:Request){
 try{
  const ctx=await authenticate(request);if(!ctx)return jsonError("로그인이 필요합니다.",401);
  const body=await request.json().catch(()=>null);
  const endpoint=body?.endpoint;
  if(typeof endpoint!=="string"||endpoint.length>2048)return jsonError("구독 정보가 필요합니다.",400);
  const {error}=await ctx.service.from("push_subscriptions").delete().eq("user_id",ctx.user.id).eq("endpoint",endpoint);
  if(error)return jsonError("알림 해제 실패",500);
  return Response.json({ok:true},{headers});
 }catch{return jsonError("알림 해제 오류",500);}
}
