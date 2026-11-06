import {authenticate,jsonError} from "@/lib/server-auth";
import {TIMETABLE_COLORS} from "@/lib/timetable";

export const runtime="nodejs";
const headers={"Cache-Control":"no-store, private"};
async function student(request:Request){
 const ctx=await authenticate(request);
 if(!ctx)return {ctx:null,error:jsonError("로그인이 필요합니다.",401)};
 if(ctx.profile.role!=="student"||ctx.profile.must_change_password)
  return {ctx:null,error:jsonError("학생 계정만 개인 시간표를 관리할 수 있습니다.",403)};
 return {ctx,error:null};
}

export async function GET(request:Request){
 try{
 const {ctx,error}=await student(request);if(error||!ctx)return error||jsonError("접근 권한이 없습니다.",403);
 const {data,error:dbError}=await ctx.service.from("personal_timetable")
  .select("id,weekday,start_period,end_period,subject,room,teacher,color")
  .eq("user_id",ctx.user.id).order("weekday").order("start_period").limit(60);
 if(dbError)return jsonError("시간표 DB 설정이 필요합니다.",500);
 return Response.json({entries:data||[]},{headers});
 }catch{return jsonError("시간표 조회 오류",500);}
}

export async function PUT(request:Request){
 try{
 const {ctx,error}=await student(request);if(error||!ctx)return error||jsonError("접근 권한이 없습니다.",403);
 const body=await request.json().catch(()=>null);
 const id=body?.id??null;
 const subject=typeof body?.subject==="string"?body.subject.trim():"";
 const room=typeof body?.room==="string"?body.room.trim():"";
 const teacher=typeof body?.teacher==="string"?body.teacher.trim():"";
 const weekday=body?.weekday,first=body?.startPeriod,last=body?.endPeriod,color=body?.color;
 if((id!==null&&(typeof id!=="string"||!/^[a-f\d-]{36}$/i.test(id)))||
  !Number.isInteger(weekday)||weekday<1||weekday>5||
  !Number.isInteger(first)||first<1||first>8||
  !Number.isInteger(last)||last<first||last>8||
  !subject||subject.length>50||room.length>60||teacher.length>60||
  !TIMETABLE_COLORS.some(c=>c===color))
  return jsonError("요일·교시·과목·색상을 확인해 주세요.",400);
 const {data,error:saveError}=await ctx.service.rpc("save_personal_timetable",{
  p_user:ctx.user.id,p_id:id,p_weekday:weekday,p_start:first,p_end:last,
  p_subject:subject,p_room:room,p_teacher:teacher,p_color:color
 });
 if(saveError)return jsonError("수업 저장 실패: 겹치는 교시 또는 DB 설정을 확인해 주세요.",409);
 return Response.json({id:data},{headers});
 }catch{return jsonError("시간표 저장 오류",500);}
}

export async function DELETE(request:Request){
 try{
 const {ctx,error}=await student(request);if(error||!ctx)return error||jsonError("접근 권한이 없습니다.",403);
 const body=await request.json().catch(()=>null);
 const id=body?.id;
 if(typeof id!=="string"||!/^[a-f\d-]{36}$/i.test(id))return jsonError("수업 ID를 확인해 주세요.",400);
 const {data,error:dbError}=await ctx.service.from("personal_timetable").delete()
  .eq("user_id",ctx.user.id).eq("id",id).select("id").maybeSingle();
 if(dbError)return jsonError("수업 삭제 오류",500);
 if(!data)return jsonError("수업을 찾을 수 없습니다.",404);
 return Response.json({ok:true},{headers});
 }catch{return jsonError("수업 삭제 오류",500);}
}
