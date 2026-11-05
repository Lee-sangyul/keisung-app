import {randomBytes} from "node:crypto";
import QRCode from "qrcode";
import {authenticate,jsonError} from "@/lib/server-auth";
import {hashToken,ID_LIFETIME_MS,idFeatureEnabled} from "@/lib/student-id";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store, private","Pragma":"no-cache"};
export async function POST(request:Request){
 try {
  if(!idFeatureEnabled())return jsonError("학생증 검증 기능이 아직 활성화되지 않았습니다.",503);
  const ctx=await authenticate(request);
  if(!ctx)return jsonError("로그인이 필요합니다.",401);
  if(ctx.profile.role!=="student"||ctx.profile.must_change_password)return jsonError("학생 계정만 발급할 수 있습니다.",403);
  if(ctx.profile.grade==null||ctx.profile.class_number==null||ctx.profile.student_number==null)
   return jsonError("학생 학적 정보가 등록되지 않았습니다. 관리자에게 문의하세요.",409);
  // Revoke previous active challenges; each QR lasts at most 45 seconds.
  await ctx.service.from("student_id_challenges").update({consumed_at:new Date().toISOString()}).eq("user_id",ctx.user.id).is("consumed_at",null);
  const payload="KSID1:"+randomBytes(32).toString("base64url");
  const expiresAt=new Date(Date.now()+ID_LIFETIME_MS).toISOString();
  const {error}=await ctx.service.from("student_id_challenges").insert({user_id:ctx.user.id,token_hash:hashToken(payload),expires_at:expiresAt});
  if(error)return jsonError("QR 생성 DB 설정을 확인해 주세요.",500);
  const svg=await QRCode.toString(payload,{type:"svg",margin:2,width:280,errorCorrectionLevel:"M",color:{dark:"#152a50",light:"#ffffff"}});
  return Response.json({svg,expiresAt,ttlSeconds:45},{headers});
 }catch{return jsonError("QR 발급 오류",500);}
}
