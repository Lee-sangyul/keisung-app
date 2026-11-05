import {adminContext,noStore} from "@/lib/admin";
import {jsonError} from "@/lib/server-auth";
import {pushConfigured,setupWebPush} from "@/lib/push";
export const runtime="nodejs";
export const maxDuration=60;
type Recipient={id:string;endpoint:string;p256dh:string;auth_key:string};
export async function POST(request:Request){
 try{
  const {ctx,error}=await adminContext(request);if(error||!ctx)return error||jsonError("권한 없음",403);
  if(!pushConfigured())return jsonError("VAPID 환경 변수를 설정하고 PUSH_ENABLED=true로 활성화하세요.",503);
  const body=await request.json().catch(()=>null);
  const title=typeof body?.title==="string"?body.title.trim():"",message=typeof body?.message==="string"?body.message.trim():"";
  const audience=body?.audience;
  const grade=body?.grade==null?null:body.grade,classNumber=body?.classNumber==null?null:body.classNumber;
  if(title.length<1||title.length>80||message.length<1||message.length>180||!["all","student","teacher"].includes(audience)
   ||(grade!==null&&(!Number.isInteger(grade)||grade<1||grade>6))
   ||(classNumber!==null&&(!Number.isInteger(classNumber)||classNumber<1||classNumber>30))
   ||((grade!==null||classNumber!==null)&&audience!=="student")
   ||body?.confirmation!=="발송")
   return jsonError("발송 내용, 대상, 확인 문구를 확인하세요.",400);
  const {data:recent,error:historyError}=await ctx.service.from("push_campaigns").select("id").eq("actor_id",ctx.user.id)
   .gte("created_at",new Date(Date.now()-2*60_000).toISOString()).limit(1);
  if(historyError)return jsonError("발송 기록 DB 설정이 필요합니다.",500);
  if(recent?.length)return jsonError("동일 관리자는 2분 후 다음 알림을 발송할 수 있습니다.",429);
  const {data,error:lookupError}=await ctx.service.rpc("list_push_recipients",{p_audience:audience,p_grade:grade,p_class:classNumber});
  if(lookupError)return jsonError("대상자 조회 DB 설정을 확인해 주세요.",500);
  const recipients=(data||[]) as Recipient[];
  if(recipients.length>1000)return jsonError("한 번에 최대 1,000개 기기에 발송할 수 있어요. 대상을 좁혀 주세요.",409);
  if(!recipients.length)return jsonError("알림을 신청한 대상자가 없습니다.",409);
  const {data:campaign,error:campaignError}=await ctx.service.from("push_campaigns").insert({
   actor_id:ctx.user.id,title,message,audience,grade,class_number:classNumber,recipient_count:recipients.length
  }).select("id").single();
  if(campaignError)return jsonError("발송 기록을 저장하지 못했습니다.",500);
  const webpush=setupWebPush();
  let sent=0,failed=0;
  // Bounded concurrency to avoid a single burst of hundreds of outbound requests.
  for(let i=0;i<recipients.length;i+=15){
   const batch=recipients.slice(i,i+15);
   await Promise.all(batch.map(async item=>{
    try{
     await webpush.sendNotification({endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth_key}},
      JSON.stringify({title,body:message,url:"/announcements"}),{TTL:3600});
     sent++;
    }catch(e){
     failed++;
     const code=(e as {statusCode?:number}).statusCode;
     if(code===404||code===410)await ctx.service.from("push_subscriptions").delete().eq("id",item.id);
    }
   }));
  }
  await ctx.service.from("push_campaigns").update({sent_count:sent,failed_count:failed}).eq("id",campaign.id);
  return Response.json({recipients:recipients.length,sent,failed},{headers:noStore});
 }catch{return jsonError("푸시 발송 중 서버 오류가 발생했습니다.",500);}
}
